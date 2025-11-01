// 画像表示部分のコンポーネント
import React from 'react';
import { Upload, Loader2, List } from 'lucide-react';

const ImageDisplay = ({ 
  originalImage, 
  predictedImage, 
  pointsImage, 
  appState,
  handleUploadClick,
  onShowParams,
  fileInputRef,
  handleImageUpload
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左列：オリジナル画像 */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-700">
              Original Image
            </h2>
            {originalImage && (
              <button
                onClick={handleUploadClick}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-1 rounded-lg transition-colors text-sm"
                disabled={appState === 'training'}
              >
                別の画像を選択
              </button>
            )}
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex items-center justify-center bg-gray-50 overflow-hidden">
            {originalImage ? (
              <img 
                src={originalImage} 
                alt="Original" 
                className="max-w-full max-h-full object-contain"
              />
            ) : appState === 'loading' ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">画像読み込み中...</p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 mb-4">画像をアップロード</p>
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
        </div>
      </div>

      {/* 中央列：予測画像 */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">
            Predicted Image
          </h2>
          <div className="border-2 border-gray-200 rounded-lg aspect-square flex items-center justify-center bg-gray-50 overflow-hidden">
            {predictedImage ? (
              <img 
                src={predictedImage} 
                alt="Predicted" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <p>処理待機中</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右列：ガウシアンポイント */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-700">
              Gaussian Points
            </h2>
            {pointsImage && (
              <button
                onClick={onShowParams}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1 rounded-lg transition-colors text-sm flex items-center gap-1"
                disabled={appState === 'training'}
              >
                <List className="w-4 h-4" />
                パラメタ編集
              </button>
            )}
          </div>
          <div className="border-2 border-gray-200 rounded-lg aspect-square flex items-center justify-center bg-gray-50 overflow-hidden">
            {pointsImage ? (
              <img 
                src={pointsImage} 
                alt="Gaussian Points" 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <p>処理待機中</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDisplay;