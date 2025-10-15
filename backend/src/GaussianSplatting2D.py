from PIL import Image, ImageDraw
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import time, os, io
import cv2
from torch.distributions import MultivariateNormal
from ImageManager import ImageManager

class GaussianSplatting2D:
    """2DGSによる画像近似"""
    _TRAIN_IMG_W = 200
    _TRAIN_IMG_H = 250
    _NUM_GAUSSIANS = 1000
    _RAND_SEED = 0
    _NUM_STEPS = 10000
    _LEARNING_RATE = 0.01

    def __init__(self, num_gaussians=_NUM_GAUSSIANS, save_dir=None):
        """コンストラクタ"""
        self.img_org = None
        self.img_array = None
        self.num_gaussians = num_gaussians
        self.params = None
        self.device = self.get_processer()
        self.save_dir = self._get_save_dir(save_dir)
        self.should_stop = False
        print(f"device: {self.device}")
        print(f"save_dir: {self.save_dir}")

    def get_processer(self):
        """利用可能なプロセッサー(CPU/GPU)を取得"""
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        return device

    def _get_save_dir(self, parent_save_dir):
        """保存先ディレクトリを設定"""
        target_dir = None
        if parent_save_dir is not None:
            if os.path.exists(parent_save_dir):
                localtime = time.strftime("%Y%m%d%H%M%S", time.localtime())
                target_dir = os.path.join(parent_save_dir, localtime)
        return target_dir

    def _init_gaussian_params_only_variance(self):
        """ガウシアン点の初期化（共分散を除外）"""
        torch.manual_seed(GaussianSplatting2D._RAND_SEED)
        height, width = self.img_array.shape
        num_gaussians = self.num_gaussians

        self.params = nn.ParameterDict({
            'means': nn.Parameter(torch.rand(num_gaussians, 2, dtype=torch.float32, device=self.device) * \
                                  torch.tensor([width, height], dtype=torch.float32, device=self.device)),
            'sigmas': nn.Parameter(torch.ones(num_gaussians, 2, dtype=torch.float32, device=self.device) * 5.0),
            'weights': nn.Parameter(torch.rand(num_gaussians, dtype=torch.float32, device=self.device) * 0.5 + 0.5)
        })

    def _gaussian_2d_batch_only_variance(self, pos, means, sigmas):
        """各点群からガウシアンを一括計算（共分散を除外）"""
        pos_exp = pos.unsqueeze(0)
        means_exp = means[:, None, None, :]
        sigmas_exp = sigmas[:, None, None, :]

        diff = pos_exp - means_exp
        denom = 2 * sigmas_exp.pow(2)
        exponent = - (diff[:, :, :, 0] ** 2 / denom[:, :, :, 0] + diff[:, :, :, 1] ** 2 / denom[:, :, :, 1])
        coeff = 1 / (2 * torch.pi * sigmas_exp[:, :, :, 0] * sigmas_exp[:, :, :, 1])

        gaussians = coeff * torch.exp(exponent)
        return gaussians

    def _init_gaussian_params(self):
        """ガウシアン点の初期化（全部ランダム）"""
        torch.manual_seed(GaussianSplatting2D._RAND_SEED)
        height, width = self.img_array.shape
        num_gaussians = self.num_gaussians

        # Gaussianパラメタの初期化（位置x,y、分散共分散s_x, s_y, s_xy、重みw）
        self.params = nn.ParameterDict({
            'means': nn.Parameter(torch.rand(num_gaussians, 2, dtype=torch.float32, device=self.device) * \
                                  torch.tensor([width, height], dtype=torch.float32, device=self.device)),
            'sigmas': (torch.cat([
                torch.ones(num_gaussians, 2, dtype=torch.float32, device = self.device) * 5.0,
                torch.zeros(num_gaussians, 1, dtype=torch.float32, device = self.device)
            ], dim=1)),
            'weights': nn.Parameter(torch.rand(num_gaussians, dtype=torch.float32, device=self.device) * 0.5 + 0.5)
        })

    def _gaussian_2d_batch(self, pos, means, sigmas):
        """
        各点群からガウシアンを一括計算（共分散行列対応版）
        pos: 座標テンソル (H, W, 2) - 評価したい点
        means: ガウシアン中心 (N, 2) - N個のガウシアンの中心
        sigmas: 共分散行列要素 (N, 3) [sigma_x, sigma_y, sigma_xy]
        
        戻り値: (N, H, W) - 各ガウシアンと各座標のPDF値
        """
        N = means.shape[0]
        H, W = pos.shape[0], pos.shape[1]
        device = pos.device

        #------------------------------------
        # 1. 共分散行列の構築 (N, 2, 2)
        sigma_x_sq = sigmas[:, 0].square()
        sigma_y_sq = sigmas[:, 1].square() 
        sigma_xy = sigmas[:, 2]

        # 正定値性の保証 (C_xy < sqrt(sigma_x^2 * sigma_y^2))
        threshold = (sigma_x_sq * sigma_y_sq).sqrt() 
        sigma_xy = torch.min(torch.max(sigma_xy, -threshold), threshold)

        # 分散共分散行列を作成 (N, 2, 2)
        cov_matrices = torch.zeros((N, 2, 2), dtype=pos.dtype, device=device)
        cov_matrices[:, 0, 0] = sigma_x_sq
        cov_matrices[:, 1, 1] = sigma_y_sq
        cov_matrices[:, 0, 1] = sigma_xy
        cov_matrices[:, 1, 0] = sigma_xy
        
        #------------------------------------
        # 2. 評価点のテンソル形状調整
        pos_eval = pos.reshape(-1, 2).unsqueeze(1)    # (H, W, 2)
        pos_eval_batch = pos_eval.expand(-1, N, -1)   # (H*W, N, 2)

        #------------------------------------
        # 3. ガウシアン計算
        m = MultivariateNormal(loc=means, covariance_matrix=cov_matrices)
        log_gaussians = m.log_prob(pos_eval_batch)          # (N, H*W)
        gaussians = torch.exp(log_gaussians.permute(1, 0))  # (N, H*W)
        gaussians = gaussians.view(N, H, W) 
        
        return gaussians

    def _gaussian_2d_batch2(self, pos, means, sigmas):
        """
        各点群からガウシアンを一括計算（共分散行列対応版）
        pos: 座標テンソル (H, W, 2)
        means: ガウシアン中心 (N, 2)
        sigmas: 共分散行列要素 (N, 3) [sigma_x, sigma_y, sigma_xy]
        """
        N = means.shape[0]
        H, W = pos.shape[0], pos.shape[1]

        # 一括計算するために、posを (1, H, W, 2) , means, sigmasを (N, 1, 1, 2/3) に拡張して計算
        pos_exp = pos.unsqueeze(0)                    # (1, H, W, 2)
        means_exp = means[:, None, None, :]           # (N, 1, 1, 2)

        # 共分散行列要素を抽出 - 形状を明示的に制御
        sigma_x = sigmas[:, 0].view(N, 1, 1)          # (N, 1, 1)
        sigma_y = sigmas[:, 1].view(N, 1, 1)          # (N, 1, 1)
        sigma_xy = sigmas[:, 2].view(N, 1, 1)         # (N, 1, 1)

        # 中心からの差分
        diff = pos_exp - means_exp                    # (N, H, W, 2)
        dx = diff[:, :, :, 0]                         # (N, H, W)
        dy = diff[:, :, :, 1]                         # (N, H, W)

        # 共分散行列の逆行列要素を計算
        # Σ = [[σx², σxy], [σxy, σy²]]
        # det(Σ) = σx² * σy² - σxy²
        det = sigma_x**2 * sigma_y**2 - sigma_xy**2   # (N, 1, 1)

        # 数値安定性のためにdetに小さな値を加算
        det = det + 1e-6

        # 逆行列要素
        inv_sigma_xx = sigma_y**2 / det               # (N, 1, 1)
        inv_sigma_yy = sigma_x**2 / det               # (N, 1, 1)
        inv_sigma_xy = -sigma_xy / det                # (N, 1, 1)

        # マハラノビス距離の二乗を計算
        # (x-μ)ᵀ Σ⁻¹ (x-μ) = dx²*inv_σxx + 2*dx*dy*inv_σxy + dy²*inv_σyy
        mahalanobis_sq = (
            dx**2 * inv_sigma_xx +
            2 * dx * dy * inv_sigma_xy +
            dy**2 * inv_sigma_yy
        )  # (N, H, W)

        # ガウシアン関数
        # 1/(2π√det) * exp(-0.5 * mahalanobis_sq)
        coeff = 1 / (2 * torch.pi * torch.sqrt(det))  # (N, 1, 1)
        gaussians = coeff * torch.exp(-0.5 * mahalanobis_sq)      # (N, H, W)
        return gaussians

    def _generate_predicted_image(self, pos):
        """予測画像を生成"""
        gaussian_pred = self._gaussian_2d_batch(pos, self.params['means'], self.params['sigmas'])
        img_pred = self.params['weights'][:, None, None] * gaussian_pred
        img_pred = torch.sum(img_pred, dim=0)
        
        # 正規化
        if img_pred.max() > 0:
            img_pred = img_pred / img_pred.max()
        
        return img_pred

    def _plot_gaussian_points(self, img_array, points):
        """ガウシアン点を画像に描画"""
        # numpy配列をPIL Imageに変換
        if img_array.max() <= 1.0:
            img_uint8 = (img_array * 255).astype(np.uint8)
        else:
            img_uint8 = img_array.astype(np.uint8)
        
        pil_img = Image.fromarray(img_uint8).convert('RGB')
        draw = ImageDraw.Draw(pil_img)
        
        # ガウシアン点を描画
        for point in points:
            x, y = point[0], point[1]
            radius = 2
            draw.ellipse(
                [x - radius, y - radius, x + radius, y + radius],
                fill=(255, 0, 0),
                outline=(255, 255, 0)
            )
        
        return np.array(pil_img)

    def generate_current_images(self):
        """現在の状態から画像を生成"""
        height, width = self.img_array.shape
        x = torch.linspace(0, width - 1, width, device=self.device)
        y = torch.linspace(0, height - 1, height, device=self.device)
        X, Y = torch.meshgrid(x, y, indexing='xy')
        pos = torch.stack([X, Y], dim=-1)

        # 予測画像生成
        img_pred = self._generate_predicted_image(pos)
        img_pred_np = img_pred.cpu().detach().numpy()
        img_pred_np = np.clip(img_pred_np, 0, 1)

        # ガウシアン点取得
        points = self.params["means"].cpu().detach().numpy()
        
        # ポイント描画画像生成
        img_with_points = self._plot_gaussian_points(img_pred_np, points)

        # Base64エンコード
        predicted_b64 = ImageManager.cv2_to_base64(img_pred_np)
        points_b64 = ImageManager.cv2_to_base64(img_with_points)

        return {
            "predicted": predicted_b64,
            "points": points_b64
        }

    async def calculate_async(self, num_steps=_NUM_STEPS, opt_lr=_LEARNING_RATE, 
                             update_interval=100, websocket=None):
        """2DGSの計算実行（非同期版）"""
        import asyncio
        
        target_img = torch.tensor(self.img_array, dtype=torch.float32, device=self.device)
        
        height, width = self.img_array.shape
        x = torch.linspace(0, width - 1, width, device=self.device)
        y = torch.linspace(0, height - 1, height, device=self.device)
        X, Y = torch.meshgrid(x, y, indexing='xy')
        pos = torch.stack([X, Y], dim=-1)

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
            
            optimizer.zero_grad()

            # 予測画像を作成
            img_pred = self._generate_predicted_image(pos)

            # 誤差計算
            loss = torch.mean((img_pred - target_img) ** 2)
            loss.backward()
            optimizer.step()

            # 定期的に更新
            if step % update_interval == 0 or step == num_steps - 1:
                message = f"Step {step+1}/{num_steps} Loss: {loss.item():.6f}"
                print(message)
                
                if websocket:
                    # 画像生成
                    images = self.generate_current_images()
                    
                    await websocket.send_json({
                        "type": "update",
                        "step": step + 1,
                        "total_steps": num_steps,
                        "loss": loss.item(),
                        "message": message,
                        "predicted_image": images["predicted"],
                        "points_image": images["points"]
                    })
                
                # 非同期処理のため少し待つ
                await asyncio.sleep(0.01)

if __name__ == "__main__":
    gs = GaussianSplatting2D()
    print("GaussianSplatting2D test OK")