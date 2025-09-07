import React, { useState, useRef } from 'react';
import { Upload, Camera, Loader2 } from 'lucide-react';

const ImageProcessingApp = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage2DGS, setProcessedImage2DGS] = useState(null);
  const [gaussianPoints, setGaussianPoints] = useState(null);
  const [processingStage, setProcessingStage] = useState(0); // 0: 待機, 1: 2DGS処理中, 2: ガウシアンポイント生成中, 3: 完了
  const fileInputRef = useRef(null);

  // Pythonバックエンドに画像を送信して2DGS処理を行う
  const process2DGS = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:18000/process/2dgs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('2DGS処理エラー:', error);
      throw error;
    }
  };

  // Pythonバックエンドでガウシアンポイント画像を生成
  const generateGaussianPointsImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:18000/process/gaussian-points', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('ガウシアンポイント生成エラー:', error);
      throw error;
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 画像プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target.result);
    };
    reader.readAsDataURL(file);

    // 処理開始
    setIsProcessing(true);
    setProcessingStage(1);
    setProcessedImage2DGS(null);
    setGaussianPoints(null);

    try {
      // 2DGS処理をPythonバックエンドに送信
      const processed2DGS = await process2DGS(file);
      setProcessedImage2DGS(processed2DGS);
      setProcessingStage(2);

      // ガウシアンポイント生成をPythonバックエンドに送信
      const gaussianImage = await generateGaussianPointsImage(file);
      setGaussianPoints(gaussianImage); // 画像URLを直接保存
      setProcessingStage(3);
      setIsProcessing(false);
    } catch (error) {
      console.error('画像処理エラー:', error);
      setIsProcessing(false);
      setProcessingStage(0);
      alert('画像処理中にエラーが発生しました。Pythonサーバーが起動しているか確認してください。');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          2DGSアプリケーション
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: オリジナル画像 */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Original Image (Grayscale)
            </h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex items-center justify-center bg-gray-50 relative overflow-hidden">
              {originalImage ? (
                <img 
                  src={originalImage} 
                  alt="Original" 
                  className="max-w-full max-h-full object-contain filter grayscale"
                />
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 mb-4">画像をアップロードしてください</p>
                  <button
                    onClick={handleUploadClick}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    画像を選択
                  </button>
                </div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {originalImage && (
              <button
                onClick={handleUploadClick}
                className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
              >
                別の画像を選択
              </button>
            )}
          </div>

          {/* 中央: 2DGS処理結果 */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              2DGS (Optimized)
            </h2>
            
            <div className="border-2 border-gray-200 rounded-lg aspect-square flex items-center justify-center bg-gray-50 relative overflow-hidden">
              {processingStage >= 2 && processedImage2DGS ? (
                <img 
                  src={processedImage2DGS} 
                  alt="2DGS Processed" 
                  className="max-w-full max-h-full object-contain opacity-80"
                />
              ) : processingStage === 1 ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                  <p className="text-gray-600">Pythonで2DGS処理中...</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p>処理待機中</p>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>2DGS処理 (Python)</span>
                <span>{processingStage >= 2 ? '100%' : processingStage === 1 ? '処理中...' : '0%'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    processingStage >= 2 ? 'bg-green-500 w-full' : 
                    processingStage === 1 ? 'bg-blue-500 w-3/4 animate-pulse' : 'bg-gray-300 w-0'
                  }`}
                ></div>
              </div>
            </div>
          </div>

          {/* 右側: ガウシアンポイント */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Gaussian Points
            </h2>
            
            <div className="border-2 border-gray-200 rounded-lg aspect-square flex items-center justify-center bg-gray-50 relative overflow-hidden">
              {processingStage >= 3 && gaussianPoints ? (
                <img 
                  src={gaussianPoints} 
                  alt="Gaussian Points" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : processingStage === 2 ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-pink-500 animate-spin mx-auto mb-2" />
                  <p className="text-gray-600">Pythonでガウシアンポイント生成中...</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p>処理待機中</p>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>ガウシアンポイント生成 (Python)</span>
                <span>{processingStage >= 3 ? '100%' : processingStage === 2 ? '処理中...' : '0%'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    processingStage >= 3 ? 'bg-green-500 w-full' : 
                    processingStage === 2 ? 'bg-pink-500 w-2/3 animate-pulse' : 'bg-gray-300 w-0'
                  }`}
                ></div>
              </div>
            </div>
            
            {processingStage >= 3 && (
              <div className="mt-3 text-sm text-gray-600">
                Python処理完了
              </div>
            )}
          </div>
        </div>

        {/* 処理状況表示 */}
        {isProcessing && (
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Python処理状況
            </h3>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 ${processingStage >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 2 ? 'bg-green-500' : processingStage === 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span>Python: 2DGS最適化処理 → http://localhost:18000/process/2dgs</span>
              </div>
              <div className={`flex items-center gap-3 ${processingStage >= 2 ? 'text-pink-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 3 ? 'bg-green-500' : processingStage === 2 ? 'bg-pink-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span>Python: ガウシアンポイント生成 → http://localhost:18000/process/gaussian-points</span>
              </div>
              <div className={`flex items-center gap-3 ${processingStage >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 3 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>全処理完了</span>
              </div>
            </div>
            
            {/* Python API接続状況 */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-700 mb-2">Python API接続情報</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>🔗 バックエンドURL: http://localhost:18000</div>
                <div>📡 通信方式: HTTP POST (multipart/form-data)</div>
                <div>🐍 Python処理: FastAPI + OpenCV + PIL</div>
              </div>
            </div>
          </div>
        )}

        {/* エラー時の情報表示 */}
        {!isProcessing && processingStage === 0 && originalImage && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-yellow-800">Python接続確認</h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>Pythonサーバーが起動していることを確認してください：</p>
              <div className="bg-yellow-100 p-3 rounded font-mono text-xs">
                <div>cd backend</div>
                <div>pip install -r requirements.txt</div>
                <div>python main.py</div>
              </div>
              <p>サーバー起動後、http://localhost:18000 でAPIが利用可能になります。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageProcessingApp;