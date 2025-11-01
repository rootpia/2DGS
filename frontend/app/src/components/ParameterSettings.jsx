// 実行条件などのパラメタ設定のコンポーネント
import React from 'react';
import { Settings, RefreshCw, Play, Square } from 'lucide-react';

const ParameterSettings = ({
  appState,
  approximationMethod,
  setApproximationMethod,
  lossFunction,
  setLossFunction,
  numGaussians,
  setNumGaussians,
  learningRate,
  setLearningRate,
  numSteps,
  setNumSteps,
  updateInterval,
  setUpdateInterval,
  handleReinitialize,
  startTraining,
  stopTraining,
  resetApp
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          パラメタ設定
        </h2>
        {(appState === 'loaded' || appState === 'paused') && (
          <button
            onClick={handleReinitialize}
            className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg transition-colors flex items-center gap-1 text-sm"
            disabled={appState === 'training'}
          >
            <RefreshCw className="w-3 h-3" />
            再初期化
          </button>
        )}
      </div>
      
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            近似方法
          </label>
          <select
            value={approximationMethod}
            onChange={(e) => setApproximationMethod(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={appState === 'training'}
          >
            <option value="covariance">分散共分散</option>
            <option value="variance">分散</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            誤差関数
          </label>
          <select
            value={lossFunction}
            onChange={(e) => setLossFunction(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={appState === 'training'}
          >
            <option value="l1_ssim">L1+SSIM</option>
            <option value="l2">L2</option>
            <option value="mse">MSE</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            ガウシアン数
          </label>
          <input
            type="number"
            value={numGaussians}
            onChange={(e) => setNumGaussians(parseInt(e.target.value))}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="1"
            max="5000"
            step="100"
            disabled={appState === 'training'}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            学習率
          </label>
          <input
            type="number"
            value={learningRate}
            onChange={(e) => setLearningRate(parseFloat(e.target.value))}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="0.001"
            max="0.1"
            step="0.001"
            disabled={appState === 'training'}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            学習ステップ数
          </label>
          <input
            type="number"
            value={numSteps}
            onChange={(e) => setNumSteps(parseInt(e.target.value))}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="100"
            max="50000"
            step="100"
            disabled={appState === 'training'}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 w-32 flex-shrink-0">
            画面更新間隔
          </label>
          <input
            type="number"
            value={updateInterval}
            onChange={(e) => setUpdateInterval(parseInt(e.target.value))}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            min="1"
            max="1000"
            step="10"
            disabled={appState === 'training'}
          />
        </div>
      </div>

      {/* 学習コントロール */}
      {(appState === 'loaded' || appState === 'training' || appState === 'paused') && (
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-700">
            学習コントロール
          </h3>

          <div className="space-y-2">
            {appState === 'loaded' || appState === 'paused' ? (
              <button
                onClick={startTraining}
                className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <Play className="w-5 h-5" />
                実行
              </button>
            ) : (
              <button
                onClick={stopTraining}
                className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <Square className="w-5 h-5" />
                学習中断
              </button>
            )}
            
            <button
              onClick={resetApp}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
              disabled={appState === 'training'}
            >
              リセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParameterSettings;