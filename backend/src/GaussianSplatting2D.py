import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import time, os, io
import cv2
import asyncio
from PIL import Image
from torch.distributions import MultivariateNormal
from pytorch_msssim import SSIM
from ImageManager import ImageManager
from GaussianParam import GaussianParamsList

class GaussianSplatting2D():
    """2DGSによる画像近似"""
    _TRAIN_IMG_W:int = 200       # デフォルト値：処理対象画像の幅
    _TRAIN_IMG_H:int = 250       # デフォルト値：処理対象画像の高さ
    _NUM_GAUSSIANS:int = 1000    # デフォルト値：ガウシアン点の数
    _RAND_SEED:int = 0           # デフォルト値：乱数シード
    _NUM_STEPS:int = 10000       # デフォルト値：学習ステップ数
    _LEARNING_RATE:float = 0.01  # デフォルト値：学習率

    def __init__(self, save_dir:str=None):
        """
        コンストラクタ
        save_dir: 保存先の親ディレクトリ
        """
        self.num_gaussians = 0
        self.img_org = None         # オリジナル画像(pil image, リサイズ後)
        self.img_array = None       # GT画像
        self.pos_for_kernel = None  # ガウシアンカーネル計算用の座標配列
        self.params = None          # ガウシアンパラメタ
        self.device = self.get_processer()
        self.save_dir = self._get_save_dir(save_dir)
        self.should_stop = False
        self.ssim_module = SSIM(data_range=1.0, size_average=True, channel=1).to(self.device)
        print(f"device: {self.device}")
        print(f"save_dir: {self.save_dir}")

    def __del__(self):
        self.img_org = None
        self.img_array = None
        self.pos_for_kernel = None
        self.params = None
        torch.cuda.empty_cache()
        # torch.cuda.synchronize()

    def initialize(self, input_image:Image, resize_w:int=_TRAIN_IMG_W, resize_h:int=_TRAIN_IMG_H,
                         num_gaussians:int=_NUM_GAUSSIANS):
        """
        初期化処理
        input_image: 入力画像。指定サイズにリサイズされる
        resize_w: リサイズ後の画像幅
        resize_h: リサイズ後の画像高さ
        num_gaussians: ガウシアン点の数
        """
        self.num_gaussians = num_gaussians
        self.img_org = input_image.convert('L').resize((resize_w, resize_h))
        np_img = np.array(self.img_org).astype(np.float32) / 255.0
        self.img_array = torch.tensor(np_img, dtype=torch.float32, device=self.device)
        self.create_gaussian_params(num_gaussians)

    def get_processer(self) -> torch.device:
        """利用可能なプロセッサー(CPU/GPU)を取得"""
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        return device

    def _get_save_dir(self, parent_save_dir:str) -> str:
        """
        保存先ディレクトリを取得
        parent_save_dir: 保存先の親ディレクトリ
        return: 保存先ディレクトリ。[親ディレクトリパス/日付ディレクトリ]を返す
        """
        target_dir = None
        if parent_save_dir is not None:
            if os.path.exists(parent_save_dir):
                localtime = time.strftime("%Y%m%d%H%M%S", time.localtime())
                target_dir = os.path.join(parent_save_dir, localtime)
        return target_dir

    def _create_pos_for_kernel(self) -> torch.Tensor:
        """
        画像フィルタ(カーネル)計算用の座標配列を作成。
        note:
          画像と同サイズのカーネルを作成し、
          ガウシアンカーネルを計算するときの要領で、ガウシアンを画像に描画する。
        return: 画像と同サイズのカーネル
        """
        height, width = self.img_array.shape
        x = torch.linspace(0, width - 1, width, device=self.device)
        y = torch.linspace(0, height - 1, height, device=self.device)
        X, Y = torch.meshgrid(x, y, indexing='xy')
        XY = torch.stack([X, Y], dim=-1)
        
        # 共分散ありパターン用に整形
        XY_reshape = XY.reshape(-1, 2).unsqueeze(1)                # (H, W, 2)
        XY_expand = XY_reshape.expand(-1, self.num_gaussians, -1)  # (H*W, N, 2)

        return XY_expand

    def create_gaussian_params(self, num_gaussians:int):
        """
        ガウシアン点の初期化（共分散あり）
        num_gaussians: ガウシアン点数
        """
        self.num_gaussians = num_gaussians
        torch.manual_seed(GaussianSplatting2D._RAND_SEED)
        height, width = self.img_array.shape

        # ガウシアンパラメタの初期化（位置x,y、分散共分散s_x, s_y, s_xy、重みw）
        self.params = nn.ParameterDict({
            'means': nn.Parameter(torch.rand(num_gaussians, 2, dtype=torch.float32, device=self.device) * \
                                  torch.tensor([width, height], dtype=torch.float32, device=self.device)),
            'sigmas': (torch.cat([
                torch.ones(num_gaussians, 2, dtype=torch.float32, device = self.device) * 5.0,
                torch.zeros(num_gaussians, 1, dtype=torch.float32, device = self.device)
            ], dim=1)),
            'weights': nn.Parameter(torch.rand(num_gaussians, dtype=torch.float32, device=self.device) * 0.5 + 0.5)
        })

        # 計算用座標配列も初期化
        self.pos_for_kernel = self._create_pos_for_kernel()

    def update_gaussian_params(self, paramslist:GaussianParamsList):
        """
        ガウシアンパラメタの更新
        paramslist: ガウシアンパラメタリスト
        """
        params = paramslist.params
        num_gaussian = len(params)
        self.create_gaussian_params(num_gaussian)
        for idx, param in enumerate(params):
            self.params['means'].data[idx, 0] = param.mean_x
            self.params['means'].data[idx, 1] = param.mean_y
            self.params['sigmas'].data[idx, 0] = param.sigma_x
            self.params['sigmas'].data[idx, 1] = param.sigma_y
            self.params['sigmas'].data[idx, 2] = param.sigma_xy
            self.params['weights'].data[idx] = param.weight

    def _gaussian_2d_batch(self, means:torch.nn.parameter.Parameter, sigmas:torch.nn.parameter.Parameter) -> torch.Tensor:
        """
        ガウシアンを一括計算（共分散あり）
        means: ガウシアン中心 (N, 2)
        sigmas: 分散共分散行列要素 (N, 3) [sigma_x_sq, sigma_y_sq, sigma_xy]
        return: (N, H, W) - ガウシアンを描画した画像N枚
        """
        num_gaussians = self.num_gaussians
        height, width = self.img_array.shape[1], self.img_array.shape[0]

        # 分散共分散行列の正定値性の保証 (C_xy < sqrt(sigma_x^2 * sigma_y^2)
        sigma_x_sq = sigmas[:, 0].square() #.data.clamp(min:=0.0)
        sigma_y_sq = sigmas[:, 1].square() #.data.clamp(min:=0.0)
        sigma_xy = sigmas[:, 2]
        threshold = (sigma_x_sq * sigma_y_sq).sqrt() - 1e-3
        sigma_xy = torch.min(torch.max(sigma_xy, -threshold), threshold)

        # 分散共分散行列を作成 (N, 2, 2)
        cov_matrices = torch.zeros((num_gaussians, 2, 2),
                                    dtype=sigmas.dtype, device=sigmas.device)
        cov_matrices[:, 0, 0] = sigma_x_sq
        cov_matrices[:, 1, 1] = sigma_y_sq
        cov_matrices[:, 0, 1] = sigma_xy
        cov_matrices[:, 1, 0] = sigma_xy
        
        # ガウシアン計算
        m = MultivariateNormal(loc=means, covariance_matrix=cov_matrices)
        log_gaussians = m.log_prob(self.pos_for_kernel)     # (N, H*W)
        gaussians = torch.exp(log_gaussians.permute(1, 0))  # (N, H*W)
        gaussians = gaussians.view(num_gaussians, width, height)

        return gaussians

    def _generate_predicted_image(self):
        """予測画像を生成"""
        gaussian_pred = self._gaussian_2d_batch(self.params['means'], self.params['sigmas'])
        img_pred = self.params['weights'][:, None, None] * gaussian_pred
        img_pred = torch.sum(img_pred, dim=0)
        img_pred = img_pred / img_pred.max()
        img_pred = torch.clamp(img_pred, min:=0, max:=1)        
        return img_pred

    def _generate_gaussian_points_image(self, target_image: np.ndarray, points: np.ndarray) -> np.ndarray:
        """
        画像にガウシアン中心点を描画
        target_image: 描画対象の画像
        points: 中心点座標の配列
        return: 描画後の画像
        """
        # 0.0〜1.0のfloat画像を、0〜255のBGR uint8画像に変換
        img_uint8 = (target_image * 255).astype(np.uint8)
        if img_uint8.ndim == 2:
            output_image = cv2.cvtColor(img_uint8, cv2.COLOR_GRAY2BGR)
        elif img_uint8.shape[-1] == 3:
            output_image = img_uint8
        else:
            raise NotImplementedError
            
        # ガウシアン中心点を描画
        radius = 1
        color_fill = (0, 0, 255)   # red
        for point in points:
            x, y = int(point[0]), int(point[1])
            cv2.circle(
                img=output_image,
                center=(x, y),
                radius=radius,
                color=color_fill,
                lineType=cv2.LINE_AA,
                thickness=-1  # 塗りつぶし
            )
        return output_image

    def generate_current_images(self) -> dict:
        """
        現在のパラメタ値から推論画像を生成
        return:
        推論画像をdict型で返す。
        1. 推論画像
        2. ガウシアン中心点をプロット付きの推論画像
        """
        # 予測画像生成
        img_pred = self._generate_predicted_image()
        img_pred_np = img_pred.cpu().detach().numpy()
        img_pred_np = np.clip(img_pred_np, 0, 1)

        # ポイント描画画像生成
        points = self.params["means"].cpu().detach().numpy()
        img_with_points = self._generate_gaussian_points_image(img_pred_np, points)

        return {
            "predicted": img_pred_np,
            "points": img_with_points
        }

    def _ssim_loss(self, img1: torch.Tensor, img2: torch.Tensor) -> torch.Tensor:
        """
        SSIM (Structural Similarity Index) 損失を計算
        img1: (H, W) のグレースケール画像テンソル
        img2: 同上
        return: SSIM損失
        """
        img1 = img1.unsqueeze(0).unsqueeze(0)
        img2 = img2.unsqueeze(0).unsqueeze(0)
        ssim_value = self.ssim_module(img1, img2)
        return 1 - ssim_value

    def _calc_loss_l1_ssim(self, img_pred: torch.Tensor, img_gt: torch.Tensor, coef:float=0.2) -> torch.Tensor:
        loss = coef * F.l1_loss(img_pred, img_gt) + \
                (1 - coef) * self._ssim_loss(img_pred, img_gt)
        return loss
    
    def _calc_loss_l2(self, img_pred: torch.Tensor, img_gt: torch.Tensor) -> torch.Tensor:
        loss = F.sse_loss(img_pred, img_gt)
        return loss
    
    def _calc_loss_mse(self, img_pred: torch.Tensor, img_gt: torch.Tensor) -> torch.Tensor:
        loss = F.mse_loss(img_pred, img_gt)
        return loss

    async def calculate_async(self, num_steps:int=_NUM_STEPS, opt_lr:float=_LEARNING_RATE, 
                             loss_func_name:str="_calc_loss_l1_ssim", update_interval:int=100, websocket=None):
        """
        2DGSの計算実行（非同期版）
        num_steps: 学習時のイテレーション回数 
        opt_lr: 学習率
        loss_func_name: 誤差計算用の関数名
        update_interval: イテレーションごとの更新タイミング
        websocket: websocket（接続が失われた際の更新エラー防止用）
        """
        target_img = self.img_array
        optimizer = optim.Adam(self.params.parameters(), lr=opt_lr)
        
        for step in range(num_steps):
            # 中断チェック
            if self.should_stop:
                print(f"[Train] Step {step}: 学習を中断しました")
                if websocket:
                    await websocket.send_json({
                        "type": "log",
                        "message": f"Step {step}: 学習を中断しました"
                    })
                break
            
            # 予測画像を作成
            optimizer.zero_grad()
            img_pred = self._generate_predicted_image()

            # 誤差計算
            method = getattr(self, loss_func_name, None)
            loss = method(img_pred, target_img)
            loss.backward()
            optimizer.step()

            # 定期的に更新
            if step % update_interval == 0 or step == num_steps - 1:
                message = f"Step {step+1}/{num_steps} Loss: {loss.item():.6f}"
                print(message)
                
                if websocket:
                    images = self.generate_current_images()
                    b64img_pred = ImageManager.cv2_to_base64(images["predicted"])
                    b64img_predpoint = ImageManager.cv2_to_base64(images["points"])
                    
                    await websocket.send_json({
                        "type": "update",
                        "step": step + 1,
                        "total_steps": num_steps,
                        "loss": loss.item(),
                        "message": message,
                        "predicted_image": b64img_pred,
                        "points_image": b64img_predpoint
                    })
                
                # 非同期処理のため少し待つ
                await asyncio.sleep(0.01)

    def __save_snap_image(self):
        """イテレーションごとの画像を保存する"""
        raise NotImplementedError
    
    def __create_snap_video(self):
        """保存した画像から動画を作成する"""
        raise NotImplementedError

if __name__ == "__main__":
    pil_image = ImageManager.open_from_filepath('/mnt/project/testdata/02_kirara_undercoat_black-modified.png')
    gs = GaussianSplatting2D()
    gs.initialize(pil_image)
    initial_images = gs.generate_current_images()

    async def test():
        await gs.calculate_async(num_gaussians:=1, num_steps:=10)
    asyncio.run(test())
    print("GaussianSplatting2D test OK")