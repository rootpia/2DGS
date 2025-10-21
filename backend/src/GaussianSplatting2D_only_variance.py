import torch
import torch.nn as nn
import asyncio

from GaussianSplatting2D import GaussianSplatting2D

class GaussianSplatting2D_only_variance(GaussianSplatting2D):
    """2DGSによる画像近似(共分散なしバージョン)"""

    def _create_pos_for_kernel(self) -> torch.Tensor:
        """
        画像フィルタ(カーネル)計算用の座標配列を作成
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
        
        # 共分散なしパターン用に整形
        XY_reshape = XY.unsqueeze(0)
        return XY_reshape

    def create_gaussian_params(self, num_gaussians:int):
        """
        ガウシアン点の初期化（共分散を除外）
        num_gaussians: ガウシアン点数
        """
        self.num_gaussians = num_gaussians
        torch.manual_seed(GaussianSplatting2D._RAND_SEED)
        height, width = self.img_array.shape

        # ガウシアンパラメタの初期化（位置x,y、分散s_x, s_y、重みw）
        self.params = nn.ParameterDict({
            'means': nn.Parameter(torch.rand(num_gaussians, 2, dtype=torch.float32, device=self.device) * \
                                  torch.tensor([width, height], dtype=torch.float32, device=self.device)),
            'sigmas': nn.Parameter(torch.ones(num_gaussians, 2, dtype=torch.float32, device=self.device) * 5.0),
            'weights': nn.Parameter(torch.rand(num_gaussians, dtype=torch.float32, device=self.device) * 0.5 + 0.5)
        })

        # 計算用座標配列も初期化
        self.pos_for_kernel = self._create_pos_for_kernel()

    def _gaussian_2d_batch(self, means:torch.nn.parameter.Parameter, sigmas:torch.nn.parameter.Parameter) -> torch.Tensor:
        """
        ガウシアンを一括計算（共分散を除外）
        means: ガウウシアン中心 (N, 2)
        sigmas: 分散共分散行列の要素 (N, 2) [sigma_x, sigma_y]
        return: ガウシアン (N, H, W)
        """
        means_exp = means[:, None, None, :]
        sigmas_exp = sigmas[:, None, None, :]

        diff = self.pos_for_kernel - means_exp
        denom = 2 * sigmas_exp.pow(2)
        exponent = - (diff[:, :, :, 0] ** 2 / denom[:, :, :, 0] + diff[:, :, :, 1] ** 2 / denom[:, :, :, 1])
        coeff = 1 / (2 * torch.pi * sigmas_exp[:, :, :, 0] * sigmas_exp[:, :, :, 1])

        gaussians = coeff * torch.exp(exponent)
        return gaussians

if __name__ == "__main__":
    from ImageManager import ImageManager

    pil_image = ImageManager.open_from_filepath('/mnt/project/testdata/02_kirara_undercoat_black-modified.png')
    gs = GaussianSplatting2D_only_variance()
    gs.initialize(pil_image)
    initial_images = gs.generate_current_images()

    async def test():
        await gs.calculate_async(num_gaussians:=1, num_steps:=10)
    asyncio.run(test())
    print("GaussianSplatting2D_only_variance test OK")