from PIL import Image
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import time
import os
from ImageManager import ImageManager

class GaussianSplatting2D:
  """
  2DGSによる画像近似
  """
  # クラス変数
  _TRAIN_IMG_W = 200            # 学習画像サイズW
  _TRAIN_IMG_H = 250            # 学習画像サイズH
  _NUM_GAUSSIANS = 1000         # 近似用のガウシアン数
  _RAND_SEED = 0                # 乱数のシード
  _NUM_STEPS = 10000            # 学習のイテレーション数
  _LEARNING_RATE = 0.01         # 学習率

  def __init__(self, num_gaussians = _NUM_GAUSSIANS, save_dir = None):
    """
    コンストラクタ
    num_gaussians: 近似用のガウシアン数
    save_dir: 学習画像の保存先。Noneの場合は未保存
    """
    self.img_org = None           # 元画像(PIL image)
    self.img_array = None         # 学習向けのGroudTruth画像(cv2)
    self.num_gaussians = num_gaussians  # ガウシアン点数
    self.params = None                  # ガウシアンパラメタ(パラメタ * num_gaussians)
    self.device = self.get_processer()  # デバイス設定（CPU/GPU）
    self.save_dir = self._get_save_dir(save_dir)  # 保存先ディレクトリ
    print(f"device: {self.device}")
    print(f"save_dir: {self.save_dir}")

  def debug(self, debug_func):
    """
    汎用デバッグ関数
    """
    debug_func(self)

  def get_processer(self):
    """
    利用可能なプロセッサー(CPU/GPU)を取得
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    return device

  def _get_save_dir(self, parent_save_dir):
    """
    保存先ディレクトリを設定.
    parent_save_dir: 保存先ディレクトリ。'指定ディレクトリ/日時ディレクトリ'を設定する。Noneの場合は未保存
    """
    target_dir = None
    if parent_save_dir is not None:
      if os.path.exists(parent_save_dir):
        localtime = time.strftime("%Y%m%d%H%M%S", time.localtime())
        target_dir = os.path.join(parent_save_dir, localtime)
    return target_dir

  def set_target_image(self, filepath:str, resize_w=_TRAIN_IMG_W, resize_h=_TRAIN_IMG_H):
    self.img_org = ImageManager.open_from_filepath(filepath)
    img_conv = self.img_org.convert('L').resize((resize_w, resize_h))
    self.img_array = np.array(img_conv).astype(np.float32) / 255.0

  def _init_gaussian_params(self):
    """
    ガウシアン点の初期化（全部ランダム）
    """
    torch.manual_seed(GaussianSplatting2D._RAND_SEED)
    height, width = self.img_array.shape
    num_gaussians = self.num_gaussians

    # Gaussianパラメタの初期化（位置x,y、対角共分散s_x, s_y、重みw）
    self.params = nn.ParameterDict({
        'means': nn.Parameter(torch.rand(num_gaussians, 2, dtype=torch.float32, device = self.device) * \
                              torch.tensor([width, height], dtype=torch.float32, device = self.device)),
        'sigmas': nn.Parameter(torch.ones(num_gaussians, 2, dtype=torch.float32, device = self.device) * 5.0),
        'weights': nn.Parameter(torch.rand(num_gaussians, dtype=torch.float32, device = self.device) * 0.5 + 0.5)
    })

  def _gaussian_2d_batch(self, pos, means, sigmas):
    """
    各点群からガウシアンを一括計算
    pos: 座標テンソル (H, W, 2)
    mean: ガウシアン中心 (N, 2)
    sigma: 共分散 (N, 2)。sigmaがゼロに収束するとマズイが...
    """
    # 一括計算するために、posを (1, H, W, 2) , means, sigmasを (N, 1, 1, 2) に拡張して計算
    pos_exp = pos.unsqueeze(0)
    means_exp = means[:, None, None, :]
    sigmas_exp = sigmas[:, None, None, :]

    diff = pos_exp - means_exp        # (N, H, W, 2)
    denom = 2 * sigmas_exp.pow(2)     # (N, 1, 1, 2)
    exponent = - (diff[:, :, :, 0] ** 2 / denom[:, :, :, 0] + diff[:, :, :, 1] ** 2 / denom[:, :, :, 1])  # (N, H, W)
    coeff = 1 / (2 * torch.pi * sigmas_exp[:, :, :, 0] * sigmas_exp[:, :, :, 1])  # (N, 1, 1)

    gaussians = coeff * torch.exp(exponent)     # (N, H, W)
    return gaussians

  def gen_image_gaussian_plot(self, target_img, points):
    """
    ガウシアン点を画像に描画
    """
    return target_img   # TODO: とりあえずそのまま返す

  def calculate(self, num_steps = _NUM_STEPS, opt_lr = _LEARNING_RATE, is_save = True):
    """
    2DGSの計算実行
    num_steps: 学習のイテレーション数
    opt_lr: 学習率
    is_save: 保存の有無
    """
    # 初期化
    target_img = torch.tensor(self.img_array, dtype=torch.float32, device=self.device)
    os.makedirs(self.save_dir, exist_ok=True)

    # 座標グリッド作成（格納値 = [X,Y,0]. [Y,X,1])
    height, width = self.img_array.shape
    x = torch.linspace(0, width - 1, width, device = self.device)
    y = torch.linspace(0, height - 1, height, device = self.device)
    X, Y = torch.meshgrid(x, y, indexing='xy')
    pos = torch.stack([X, Y], dim=-1)  # (H,W,2)

    # Gaussianパラメタの初期化（位置x,y、対角共分散s_x, s_y、重みw）
    self._init_gaussian_params()

    # 初期化したガウシアン点を表示
    if is_save:
      points = self.params["means"].cpu().detach().numpy()
      img_pred_np = self.gen_image_gaussian_plot(self.img_array, np.round(points))
      filepath = os.path.join(self.save_dir, "step000000.png")
      cv2.imwrite(filepath, img_pred_np)

    # 最適化
    optimizer = optim.Adam(self.params.parameters(), lr=opt_lr)
    for step in range(num_steps):
      optimizer.zero_grad()

      # 予測画像を作成
      gaussian_pred = self._gaussian_2d_batch(pos, self.params['means'], self.params['sigmas'])
      img_pred = self.params['weights'][:, None, None] * gaussian_pred
      img_pred = torch.sum(img_pred, dim=0)
      img_pred = img_pred / img_pred.max()

      # 誤差計算（平均二乗誤差）
      loss = torch.mean((img_pred - target_img) ** 2)
      loss.backward()
      optimizer.step()

      # output
      if step % show_interval == 0 or step == num_steps - 1:
        message = f"Step {step+1}/{num_steps} Loss: {loss.item():.6f}"
        # 可視化
        img_pred_np = img_pred.cpu().detach().numpy()
        img_pred_np[img_pred_np < 0] = 0
        points = self.params["means"].cpu().detach().numpy()
        img_pred_np_pt = self.gen_image_gaussian_plot(img_pred_np, points)

        # 保存
        if is_save:
          filepath = os.path.join(self.save_dir, f"step{step+1:06}")
          cv2.imwrite(filepath, img_pred_np_pt)


if __name__ == "__main__":
  gs = GaussianSplatting2D()
  gs.set_target_image("/mnt/project/testdata/02_kirara_undercoat_black-modified.png")