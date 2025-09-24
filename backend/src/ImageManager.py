import numpy as np
from PIL import Image
import cv2
import io

class ImageManager:
    """
    画像変換関係のユーティリティクラス
    """
    @staticmethod
    def image_to_bytes(image: Image.Image, format: str = "PNG") -> io.BytesIO:
        """PIL Imageをバイトストリームに変換"""
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format=format)
        img_byte_arr.seek(0)
        return img_byte_arr

    @staticmethod
    def pil_to_cv2(pil_image: Image.Image) -> np.ndarray:
        """PIL ImageをOpenCV形式(numpy array)に変換"""
        # PILからnumpy arrayに変換
        if pil_image.mode == 'RGB':
            # RGBからBGRに変換（OpenCVはBGR形式）
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        elif pil_image.mode == 'L':
            # グレースケールの場合はそのまま
            cv_image = np.array(pil_image)
        elif pil_image.mode == 'RGBA':
            # RGBAからBGRAに変換
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGBA2BGRA)
        else:
            # その他の形式はRGBに変換してからBGRに
            rgb_image = pil_image.convert('RGB')
            cv_image = cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)
        
        return cv_image

    @staticmethod
    def cv2_to_pil(cv_image: np.ndarray) -> Image.Image:
        """OpenCV形式(numpy array)をPIL Imageに変換"""
        if len(cv_image.shape) == 2:
            # グレースケールの場合
            pil_image = Image.fromarray(cv_image, mode='L')
        elif len(cv_image.shape) == 3:
            if cv_image.shape[2] == 3:
                # BGRからRGBに変換
                rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_image, mode='RGB')
            elif cv_image.shape[2] == 4:
                # BGRAからRGBAに変換
                rgba_image = cv2.cvtColor(cv_image, cv2.COLOR_BGRA2RGBA)
                pil_image = Image.fromarray(rgba_image, mode='RGBA')
            else:
                raise ValueError(f"サポートされていないチャンネル数: {cv_image.shape[2]}")
        else:
            raise ValueError(f"サポートされていない画像形状: {cv_image.shape}")
        
        return pil_image

if __name__ == "__main__":
    img = Image.open("../../testdata/02_kirara_undercoat_black-modified.png").convert("L")
    print(img.mode)
    print(img.size)
    cv_img = ImageManager.pil_to_cv2(img)
    print(cv_img.shape)
    pil_img = ImageManager.cv2_to_pil(cv_img)
    print(pil_img.mode)
    img_bytes = ImageManager.image_to_bytes(pil_img, "PNG")
    print(img_bytes.getvalue()) 

    #---------------
    img = Image.open("../../testdata/02_kirara_undercoat_black-modified.png").convert("RGB")
    print(img.mode)
    print(img.size)
    cv_img = ImageManager.pil_to_cv2(img)
    print(cv_img.shape)
    pil_img = ImageManager.cv2_to_pil(cv_img)
    print(pil_img.mode)
    img_bytes = ImageManager.image_to_bytes(pil_img, "PNG")
    print(img_bytes.getvalue()) 
