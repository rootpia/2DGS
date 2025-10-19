import numpy as np
from PIL import Image
import cv2
import io, os, base64
from fastapi import UploadFile, HTTPException

class ImageManager:
    """
    画像変換関係のユーティリティクラス
    """
    @staticmethod
    def open_from_filepath(filepath: str) -> Image:
        """ファイルパスからPIL Imageを開く"""
        try:
            image = Image.open(filepath)
            return image
        except Exception as e:
            raise e

    @staticmethod
    def open_from_uploadfile(file: UploadFile) -> Image:
        """アップロードファイルからPIL Imageを作成"""
        try:
            image_data = file.file.read()
            image = Image.open(io.BytesIO(image_data))
            if image.mode == 'RGBA':
                image = image.convert('RGB')
            return image
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {str(e)}")

    @staticmethod
    def pil_to_bytes(image: Image.Image, format: str = "PNG") -> io.BytesIO:
        """PIL Imageをバイトストリームに変換"""
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format=format)
        img_byte_arr.seek(0)
        return img_byte_arr

    @staticmethod
    def cv2_to_bytes(image: np.ndarray, format: str = "PNG") -> io.BytesIO:
        """OpenCV形式(numpy array)をバイトストリームに変換"""
        ret, encoded_image = cv2.imencode(f".{format}", image)
        if not ret:
            raise IOError(f"Failed to encode image to {format} format.")
        img_byte_arr = io.BytesIO()
        img_byte_arr.write(encoded_image.tobytes())
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

    @staticmethod
    def cv2_to_base64(img_array: np.ndarray): # -> bytes:
        """Numpy配列をBase64文字列に変換"""
        if img_array.max() <= 1.0:
            img_uint8 = (img_array * 255).astype(np.uint8)
        else:
            img_uint8 = img_array.astype(np.uint8)  
                  
        pil_img = ImageManager.cv2_to_pil(img_uint8)
        img_bytes = ImageManager.pil_to_bytes(pil_img, "PNG")
        return base64.b64encode(img_bytes.getvalue()).decode('utf-8')

if __name__ == "__main__":
    pil_img = ImageManager.open_from_filepath("/mnt/project/testdata/02_kirara_undercoat_black-modified.png")
    pil_gray = pil_img.convert("L")
    print(pil_gray.mode)
    print(pil_gray.size)
    cv_img = ImageManager.pil_to_cv2(pil_gray)
    print(cv_img.shape)
    pil_gray = ImageManager.cv2_to_pil(cv_img)
    print(pil_gray.mode)
    cv2_bytes = ImageManager.cv2_to_bytes(cv_img, "PNG")
    print(len(cv2_bytes.getvalue())) 
    pil_bytes = ImageManager.pil_to_bytes(pil_gray, "PNG")
    print(len(pil_bytes.getvalue()))
    b64_img = ImageManager.cv2_to_base64(cv_img)
    print(b64_img)