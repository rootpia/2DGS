from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import cv2
import io
import random

app = FastAPI(title="2DGS_API", version="1.0.0")

# CORS設定（React開発サーバーからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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

def apply_2dgs_effect(image: Image.Image) -> Image.Image:
    """2DGS風の画像処理を適用"""
    # グレースケール変換
    gray_image = image.convert('L')
    
    # OpenCVで高度なフィルタ処理
    cv_image = np.array(gray_image)
    
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
    
    # PIL Imageに戻す
    result_image = Image.fromarray(denoised).convert('RGB')
    
    return result_image

def generate_gaussian_points_image(image: Image.Image) -> Image.Image:
    """ガウシアンポイントを生成して画像に描画"""
    width, height = image.size
    
    # 背景として薄いグレースケール画像を使用
    gray_bg = image.convert('L').convert('RGB')
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # ガウシアンポイント数をランダムに決定
    num_points = random.randint(200, 500)
    
    # 画像の重要な領域を検出（簡易版）
    gray_array = np.array(image.convert('L'))
    edges = cv2.Canny(gray_array, 50, 150)
    edge_points = np.column_stack(np.where(edges > 0))
    
    points_generated = 0
    
    # エッジ周辺により多くのポイントを配置
    for _ in range(num_points // 2):
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
        import colorsys
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
    
    return result

@app.get("/")
async def root():
    return {"message": "画像処理APIサーバーが稼働中です"}

@app.post("/process/2dgs")
async def process_2dgs(image: UploadFile = File(...)):
    """2DGS処理を実行"""
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    try:
        # 画像を読み込み
        pil_image = load_image_from_upload(image)
        
        # 2DGS処理を適用
        processed_image = apply_2dgs_effect(pil_image)
        
        # バイトストリームに変換
        img_bytes = image_to_bytes(processed_image, "PNG")
        
        return StreamingResponse(
            io.BytesIO(img_bytes.read()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=2dgs_processed.png"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"2DGS処理中にエラーが発生しました: {str(e)}")

@app.post("/process/gaussian-points")
async def process_gaussian_points(image: UploadFile = File(...)):
    """ガウシアンポイント生成を実行"""
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    try:
        # 画像を読み込み
        pil_image = load_image_from_upload(image)
        
        # ガウシアンポイント画像を生成
        points_image = generate_gaussian_points_image(pil_image)
        
        # バイトストリームに変換
        img_bytes = image_to_bytes(points_image, "PNG")
        
        return StreamingResponse(
            io.BytesIO(img_bytes.read()),
            media_type="image/png",
            headers={"Content-Disposition": "inline; filename=gaussian_points.png"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ガウシアンポイント生成中にエラーが発生しました: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18000)
