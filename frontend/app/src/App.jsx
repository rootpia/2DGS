import React, { useState, useRef } from 'react';
import { Upload, Camera, Loader2 } from 'lucide-react';

const ImageProcessingApp = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage2DGS, setProcessedImage2DGS] = useState(null);
  const [gaussianPoints, setGaussianPoints] = useState(null);
  const [processingStage, setProcessingStage] = useState(0); // 0: 待機, 1: オリジナル処理中, 2: 2DGS処理中, 3: ガウシアンポイント生成中, 4: 完了
  const [currentFile, setCurrentFile] = useState(null);
  const fileInputRef = useRef(null);

  // Pythonバックエンドにオリジナル画像を送信してグレースケール変換
  const processOriginal = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:18000/process/original', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('オリジナル画像処理エラー:', error);
      throw error;
    }
  };

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

    // ファイルを保存
    setCurrentFile(file);

    // 状態をリセット
    setOriginalImage(null);
    setProcessedImage2DGS(null);
    setGaussianPoints(null);
    setIsProcessing(true);
    setProcessingStage(1);

    try {
      // 1. オリジナル画像をPythonバックエンドで処理（グレースケール変換）
      const processedOriginal = await processOriginal(file);
      setOriginalImage(processedOriginal);
      setProcessingStage(2);

      // 2. 2DGS処理をPythonバックエンドに送信
      const processed2DGS = await process2DGS(file);
      setProcessedImage2DGS(processed2DGS);
      setProcessingStage(3);

      // 3. ガウシアンポイント生成をPythonバックエンドに送信
      const gaussianImage = await generateGaussianPointsImage(file);
      setGaussianPoints(gaussianImage);
      setProcessingStage(4);
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

  const getStageLabel = (stage) => {
    switch(stage) {
      case 0: return '待機中';
      case 1: return 'オリジナル画像処理中...';
      case 2: return '2DGS処理中...';
      case 3: return 'ガウシアンポイント生成中...';
      case 4: return '処理完了';
      default: return '不明';
    }
  };

  const getProgressPercentage = (stage) => {
    switch(stage) {
      case 0: return 0;
      case 1: return 25;
      case 2: return 50;
      case 3: return 75;
      case 4: return 100;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          2DGSアプリケーション
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: オリジナル画像（バックエンド処理済み） */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Original Image (Grayscale)
            </h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex items-center justify-center bg-gray-50 relative overflow-hidden">
              {originalImage ? (
                <img 
                  src={originalImage} 
                  alt="Original Processed" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : processingStage === 1 ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                  <p className="text-gray-600">Pythonで画像読み込み中...</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 mb-4">画像をアップロードしてください</p>
                  <button
                    onClick={handleUploadClick}
                    disabled={isProcessing}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
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
              disabled={isProcessing}
            />
            
            {/* オリジナル画像の処理状況 */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>オリジナル画像処理 (Python)</span>
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
            
            {originalImage && !isProcessing && (
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
              {processedImage2DGS ? (
                <img 
                  src={processedImage2DGS} 
                  alt="2DGS Processed" 
                  className="max-w-full max-h-full object-contain opacity-80"
                />
              ) : processingStage === 2 ? (
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
                <span>{processingStage >= 3 ? '100%' : processingStage === 2 ? '処理中...' : '0%'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    processingStage >= 3 ? 'bg-green-500 w-full' : 
                    processingStage === 2 ? 'bg-blue-500 w-3/4 animate-pulse' : 'bg-gray-300 w-0'
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
              {gaussianPoints ? (
                <img 
                  src={gaussianPoints} 
                  alt="Gaussian Points" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : processingStage === 3 ? (
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
                <span>{processingStage >= 4 ? '100%' : processingStage === 3 ? '処理中...' : '0%'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    processingStage >= 4 ? 'bg-green-500 w-full' : 
                    processingStage === 3 ? 'bg-pink-500 w-2/3 animate-pulse' : 'bg-gray-300 w-0'
                  }`}
                ></div>
              </div>
            </div>
            
            {processingStage >= 4 && (
              <div className="mt-3 text-sm text-gray-600">
                全Python処理完了
              </div>
            )}
          </div>
        </div>

        {/* 全体の処理状況表示 */}
        {isProcessing && (
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Python処理状況: {getStageLabel(processingStage)}
            </h3>
            
            {/* 全体プログレスバー */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>全体進捗</span>
                <span>{getProgressPercentage(processingStage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${getProgressPercentage(processingStage)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className={`flex items-center gap-3 ${processingStage >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 2 ? 'bg-green-500' : processingStage === 1 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span>Python: オリジナル画像処理（グレースケール変換） → http://localhost:18000/process/original</span>
              </div>
              <div className={`flex items-center gap-3 ${processingStage >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 3 ? 'bg-green-500' : processingStage === 2 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span>Python: 2DGS最適化処理 → http://localhost:18000/process/2dgs</span>
              </div>
              <div className={`flex items-center gap-3 ${processingStage >= 3 ? 'text-pink-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 4 ? 'bg-green-500' : processingStage === 3 ? 'bg-pink-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <span>Python: ガウシアンポイント生成 → http://localhost:18000/process/gaussian-points</span>
              </div>
              <div className={`flex items-center gap-3 ${processingStage >= 4 ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-4 h-4 rounded-full ${processingStage >= 4 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
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
                <div>📊 処理段階: {currentFile ? `${currentFile.name} を処理中` : 'ファイル待機中'}</div>
              </div>
            </div>
          </div>
        )}

        {/* サーバー接続確認情報 */}
        {!isProcessing && processingStage === 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">Python API準備完了</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>以下のエンドポイントが利用可能です：</p>
              <div className="bg-blue-100 p-3 rounded font-mono text-xs space-y-1">
                <div>GET  http://localhost:18000/health - サーバー状態確認</div>
                <div>POST http://localhost:18000/process/original - オリジナル画像処理</div>
                <div>POST http://localhost:18000/process/2dgs - 2DGS処理</div>
                <div>POST http://localhost:18000/process/gaussian-points - ガウシアンポイント生成</div>
              </div>
              <p>画像をアップロードすると、全ての処理がPythonバックエンドで実行されます。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageProcessingApp;
