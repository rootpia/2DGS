from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import cv2
import io
import random
import colorsys

app = FastAPI(title="画像処理API", version="1.0.0")

# CORS設定（React開発サーバーからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_image_from_upload(file: UploadFile) -> Image.Image:
    """アップロードファイルからPIL Imageを作成"""
    try:
        image_data = file.file.read()
        image = Image.open(io.BytesIO(image_data))
        # RGBAの場合はRGBに変換
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {str(e)}")

def image_to_bytes(image: Image.Image, format: str = "PNG") -> io.BytesIO:
    """PIL Imageをバイトストリームに変換"""
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format=format)
    img_byte_arr.seek(0)
    return img_byte_arr

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

def apply_2dgs_effect(image: Image.Image) -> Image.Image:
    """2DGS風の画像処理を適用（修正版）"""
    try:
        # グレースケール変換
        gray_image = image.convert('L')
        
        # PILからOpenCVに変換
        cv_image = np.array(gray_image)
        
        # 画像のデータ型を確認・修正
        if cv_image.dtype != np.uint8:
            cv_image = cv_image.astype(np.uint8)
        
        print(f"OpenCV画像形状: {cv_image.shape}, データ型: {cv_image.dtype}")
        
        # ガウシアンブラーでぼかし効果
        blurred = cv2.GaussianBlur(cv_image, (15, 15), 0)
        
        # エッジ保持平滑化フィルタ
        smoothed = cv2.bilateralFilter(blurred, 9, 75, 75)
        
        # コントラスト調整
        alpha = 1.2  # コントラスト
        beta = -30   # ブライトネス
        adjusted = cv2.convertScaleAbs(smoothed, alpha=alpha, beta=beta)
        
        # ノイズリダクション
        denoised = cv2.fastNlMeansDenoising(adjusted)
        
        # OpenCVからPILに変換（グレースケール→RGB）
        result_image = Image.fromarray(denoised, mode='L').convert('RGB')
        
        print(f"結果画像モード: {result_image.mode}, サイズ: {result_image.size}")
        
        return result_image
        
    except Exception as e:
        print(f"2DGS処理エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"2DGS処理中にエラー: {str(e)}")

def generate_gaussian_points_image(image: Image.Image) -> Image.Image:
    """ガウシアンポイントを生成して画像に描画（修正版）"""
    try:
        width, height = image.size
        
        # 背景として薄いグレースケール画像を使用
        gray_bg = image.convert('L').convert('RGB')
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # ガウシアンポイント数をランダムに決定
        num_points = random.randint(200, 500)
        
        # 画像の重要な領域を検出（OpenCVを使用）
        gray_array = np.array(image.convert('L'))
        
        # データ型を確認
        if gray_array.dtype != np.uint8:
            gray_array = gray_array.astype(np.uint8)
        
        edges = cv2.Canny(gray_array, 50, 150)
        edge_points = np.column_stack(np.where(edges > 0))
        
        points_generated = 0
        
        # エッジ周辺により多くのポイントを配置
        for _ in range(min(num_points // 2, len(edge_points))):
            if len(edge_points) > 0 and points_generated < num_points:
                # エッジ近くにポイントを配置
                edge_idx = random.randint(0, len(edge_points) - 1)
                y, x = edge_points[edge_idx]
                
                # 少しランダムにオフセット
                x += random.randint(-20, 20)
                y += random.randint(-20, 20)
                
                # 画像範囲内に制限
                x = max(0, min(width - 1, x))
                y = max(0, min(height - 1, y))
                
            else:
                # ランダムな位置
                x = random.randint(0, width - 1)
                y = random.randint(0, height - 1)
            
            # ポイントのプロパティ
            radius = random.uniform(2, 8)
            opacity = random.randint(50, 200)
            
            # カラフルなポイント（ピンク〜赤系）
            hue = random.uniform(300, 360)  # ピンク〜マゼンタ
            saturation = random.uniform(0.6, 1.0)
            lightness = random.uniform(0.4, 0.8)
            
            # HSLをRGBに変換
            r, g, b = colorsys.hls_to_rgb(hue/360, lightness, saturation)
            color = (int(r*255), int(g*255), int(b*255), opacity)
            
            # 円を描画
            draw.ellipse(
                [x-radius, y-radius, x+radius, y+radius],
                fill=color,
                outline=None
            )
            points_generated += 1
        
        # 残りのポイントをランダムに配置
        for _ in range(num_points - points_generated):
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            radius = random.uniform(1, 5)
            opacity = random.randint(30, 150)
            
            # より薄い色のポイント
            hue = random.uniform(320, 360)
            r, g, b = colorsys.hls_to_rgb(hue/360, 0.6, 0.7)
            color = (int(r*255), int(g*255), int(b*255), opacity)
            
            draw.ellipse(
                [x-radius, y-radius, x+radius, y+radius],
                fill=color,
                outline=None
            )
        
        # 背景と合成
        result = Image.alpha_composite(
            gray_bg.convert('RGBA'), 
            overlay
        ).convert('RGB')
        
        print(f"ガウシアンポイント画像完成: {result.mode}, {result.size}")
        
        return result
        
    except Exception as e:
        print(f"ガウシアンポイント生成エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ガウシアンポイント生成エラー: {str(e)}")

@app.get("/")
async def root():
    return {"message": "画像処理APIサーバーが稼働中です"}

@app.get("/health")
async def health():
    """ヘルスチェック用エンドポイント"""
    return {"status": "healthy", "opencv_version": cv2.__version__}

@app.post("/process/original")
async def process_original(image: UploadFile = File(...)):
    """オリジナル画像をグレースケール変換して返す"""
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    try:
        print(f"オリジナル画像処理開始: {image.filename}, {image.content_type}")
        
        # 画像を読み込み
        pil_image = load_image_from_upload(image)
        print(f"画像読み込み完了: {pil_image.mode}, {pil_image.size}")
        
        # グレースケールに変換
        grayscale_image = pil_image.convert('L').convert('RGB')
        
        # バイトストリームに変換
        img_bytes = image_to_bytes(grayscale_image, "PNG")
        
        print("オリジナル画像処理完了、レスポンス送信")
        
        return StreamingResponse(
            io.BytesIO(img_bytes.read()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=original_grayscale.png"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"予期しないエラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"オリジナル画像処理中にエラーが発生しました: {str(e)}")

@app.post("/process/2dgs")
async def process_2dgs(image: UploadFile = File(...)):
    """2DGS処理を実行"""
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    try:
        print(f"2DGS処理開始: {image.filename}, {image.content_type}")
        
        # 画像を読み込み
        pil_image = load_image_from_upload(image)
        print(f"画像読み込み完了: {pil_image.mode}, {pil_image.size}")
        
        # 2DGS処理を適用
        processed_image = apply_2dgs_effect(pil_image)
        
        # バイトストリームに変換
        img_bytes = image_to_bytes(processed_image, "PNG")
        
        print("2DGS処理完了、レスポンス送信")
        
        return StreamingResponse(
            io.BytesIO(img_bytes.read()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=2dgs_processed.png"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"予期しないエラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"2DGS処理中にエラーが発生しました: {str(e)}")

@app.post("/process/gaussian-points")
async def process_gaussian_points(image: UploadFile = File(...)):
    """ガウシアンポイント生成を実行"""
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    try:
        print(f"ガウシアンポイント生成開始: {image.filename}, {image.content_type}")
        
        # 画像を読み込み
        pil_image = load_image_from_upload(image)
        print(f"画像読み込み完了: {pil_image.mode}, {pil_image.size}")
        
        # ガウシアンポイント画像を生成
        points_image = generate_gaussian_points_image(pil_image)
        
        # バイトストリームに変換
        img_bytes = image_to_bytes(points_image, "PNG")
        
        print("ガウシアンポイント生成完了、レスポンス送信")
        
        return StreamingResponse(
            io.BytesIO(img_bytes.read()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=gaussian_points.png"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"予期しないエラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ガウシアンポイント生成中にエラーが発生しました: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18000)
