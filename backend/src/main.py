from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from PIL import Image
import asyncio
import json
from typing import Optional
from ImageManager import ImageManager
from GaussianSplatting2D import GaussianSplatting2D
from GaussianSplatting2D_only_variance import GaussianSplatting2D_only_variance

# Global
APP_VERSION = "2.0.0"
app = FastAPI(title="2dgs_API", version=APP_VERSION)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバル変数
gs_instance: Optional[GaussianSplatting2D] = None
is_processing = False
should_stop = False

class GSParams(BaseModel):
    num_gaussians: int = 1000
    learning_rate: float = 0.01
    num_steps: int = 10000

@app.get("/")
async def root():
    return {"status": "service available",
            "version": APP_VERSION,
            "message": "画像処理APIサーバーが稼働中です"}

@app.get("/health")
async def health():
    """ヘルスチェック用エンドポイント"""
    return root()

@app.get("/device-info")
async def device_info():
    """デバイス情報取得"""
    global gs_instance
    gs_tmp = gs_instance if gs_instance is not None else GaussianSplatting2D()
    device = gs_tmp.get_processer()
    return {
        "device": "GPU" if device.type == "cuda" else "CPU",
        "device_name": str(device)
    }

@app.post("/initialize")
async def initialize_gs(
    image: UploadFile = File(...),
    class_name: str = "GaussianSplatting2D",
    num_gaussians: int = 1000
):
    """GaussianSplatting2Dの初期化"""
    global gs_instance
    
    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="画像ファイルを選択してください")
    
    class_object = globals().get(class_name)
    if class_object is None or not isinstance(class_object, type):
        raise ValueError(f"クラス名 '{class_name}' は見つからないか、クラスではありません。")
    
    try:
        print(f"[Initialize] 開始: class={class_name}, num_gaussians={num_gaussians}")
        
        # 画像を読み込み、リサイズ比計算
        pil_image = ImageManager.open_from_uploadfile(image)
        org_w, org_h = pil_image.size
        aspect_ratio = org_w / org_h
        new_h = 250
        new_w = int(new_h * aspect_ratio)

        # インスタンス初期化
        gs_instance = class_object()
        gs_instance.initialize(pil_image, resize_w:=new_w, resize_h:=new_h,
                               num_gaussians=num_gaussians)
        initial_images = gs_instance.generate_current_images()

        b64img_org = ImageManager.pil_to_base64(gs_instance.img_org)
        b64img_pred = ImageManager.cv2_to_base64(initial_images["predicted"])
        b64img_predpoint = ImageManager.cv2_to_base64(initial_images["points"])

        print(f"[Initialize] 完了")
        
        return {
            "status": "initialized",
            "num_gaussians": num_gaussians,
            "original_image": b64img_org,
            "predicted_image": b64img_pred,
            "points_image": b64img_predpoint
        }
        
    except Exception as e:
        print(f"[Initialize] エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"初期化エラー: {str(e)}")

@app.post("/reinitialize")
async def reinitialize_gs(class_name: str = "GaussianSplatting2D",
                          num_gaussians: int = 1000):
    """既存の画像でガウシアンパラメータを再初期化"""
    global gs_instance
    
    if gs_instance is None or gs_instance.img_array is None:
        raise HTTPException(status_code=400, detail="画像が読み込まれていません")
    
    class_object = globals().get(class_name)
    if class_object is None or not isinstance(class_object, type):
        raise ValueError(f"クラス名 '{class_name}' は見つからないか、クラスではありません")

    # クラス(=処理方法)を切替
    if not isinstance(gs_instance, class_object):
        input_image = gs_instance.img_org
        resize_w, resize_h = input_image.size
        num_gaussians = num_gaussians
        gs_instance = class_object()
        gs_instance.initialize(input_image:=input_image,
                            resize_w:=resize_w, resize_h:=resize_h, num_gaussians:=num_gaussians)

    try:
        print(f"[Reinitialize] 開始: num_gaussians={num_gaussians}")
        gs_instance.create_gaussian_params(num_gaussians)
        initial_images = gs_instance.generate_current_images()
        b64img_pred = ImageManager.cv2_to_base64(initial_images["predicted"])
        b64img_predpoint = ImageManager.cv2_to_base64(initial_images["points"])
        print(f"[Reinitialize] 完了")
        
        return {
            "status": "reinitialized",
            "num_gaussians": num_gaussians,
            "predicted_image": b64img_pred,
            "points_image": b64img_predpoint
        }
        
    except Exception as e:
        print(f"[Reinitialize] エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"再初期化エラー: {str(e)}")

@app.websocket("/train")
async def websocket_train(websocket: WebSocket):
    """WebSocketで学習実行"""
    global gs_instance, is_processing, should_stop
    
    await websocket.accept()
    
    try:
        # パラメータ受信
        data = await websocket.receive_text()
        params = json.loads(data)
        
        learning_rate = params.get("learning_rate", 0.01)
        num_steps = params.get("num_steps", 10000)
        update_interval = params.get("update_interval", 100)
        loss_function = params.get("loss_function", "_calc_loss_l1_ssim")

        if gs_instance is None:
            await websocket.send_json({
                "type": "error",
                "message": "GaussianSplattingが初期化されていません"
            })
            return
        
        # フラグをリセット
        is_processing = True
        should_stop = False
        if gs_instance:
            gs_instance.should_stop = False
        
        print(f"[Train] 開始: lr={learning_rate}, steps={num_steps}")
        
        # 学習実行
        await gs_instance.calculate_async(
            num_steps=num_steps,
            opt_lr=learning_rate,
            loss_func_name=loss_function,
            update_interval=update_interval,
            websocket=websocket
        )
        
        print(f"[Train] 完了")
        
        await websocket.send_json({
            "type": "complete",
            "message": "学習が完了しました"
        })
        
    except WebSocketDisconnect:
        print("[Train] WebSocket切断")
    except Exception as e:
        print(f"[Train] エラー: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    finally:
        is_processing = False
        should_stop = False
        if gs_instance:
            gs_instance.should_stop = False

@app.post("/stop")
async def stop_training():
    """学習中断"""
    global gs_instance, should_stop
    should_stop = True
    if gs_instance:
        gs_instance.should_stop = True
    print("[Stop] 学習中断リクエスト")
    return {"status": "stopping"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=18000)