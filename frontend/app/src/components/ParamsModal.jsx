// ガウシアンパラメタ値の編集用コンポーネント
import React, { useRef } from 'react';
import { List, X, FileUp, Download, Save, Loader2 } from 'lucide-react';

const ParamsModal = ({ 
  showParams, 
  setShowParams, 
  gaussianParams, 
  hasCovariance, 
  loadingParams,
  handleParamChange,
  updateGaussianParams,
  exportParamsAsCSV,
  importParamsFromCSV
}) => {
  const paramFileInputRef = useRef(null);

  if (!showParams) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <List className="w-6 h-6 text-indigo-500" />
            ガウシアンパラメタ {hasCovariance ? '(分散共分散)' : '(分散のみ)'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => paramFileInputRef.current?.click()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <FileUp className="w-4 h-4" />
              インポート
            </button>
            <input
              ref={paramFileInputRef}
              type="file"
              accept=".csv"
              onChange={importParamsFromCSV}
              className="hidden"
            />
            <button
              onClick={exportParamsAsCSV}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              エクスポート
            </button>
            <button
              onClick={() => setShowParams(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loadingParams ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="ml-3 text-gray-600">読み込み中...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Index</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Mean X</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Mean Y</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sigma X</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sigma Y</th>
                    {hasCovariance && (
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Sigma XY</th>
                    )}
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {gaussianParams.map((param) => (
                    <tr key={param.index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2">{param.index}</td>
                      <td className="border border-gray-300 px-1 py-1">
                        <input
                          type="number"
                          value={param.mean_x.toFixed(4)}
                          onChange={(e) => handleParamChange(param.index, 'mean_x', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                          step="0.1"
                        />
                      </td>
                      <td className="border border-gray-300 px-1 py-1">
                        <input
                          type="number"
                          value={param.mean_y.toFixed(4)}
                          onChange={(e) => handleParamChange(param.index, 'mean_y', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                          step="0.1"
                        />
                      </td>
                      <td className="border border-gray-300 px-1 py-1">
                        <input
                          type="number"
                          value={param.sigma_x.toFixed(4)}
                          onChange={(e) => handleParamChange(param.index, 'sigma_x', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                          step="0.1"
                        />
                      </td>
                      <td className="border border-gray-300 px-1 py-1">
                        <input
                          type="number"
                          value={param.sigma_y.toFixed(4)}
                          onChange={(e) => handleParamChange(param.index, 'sigma_y', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                          step="0.1"
                        />
                      </td>
                      {hasCovariance && (
                        <td className="border border-gray-300 px-1 py-1">
                          <input
                            type="number"
                            value={param.sigma_xy?.toFixed(4) || '0'}
                            onChange={(e) => handleParamChange(param.index, 'sigma_xy', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                            step="0.1"
                          />
                        </td>
                      )}
                      <td className="border border-gray-300 px-1 py-1">
                        <input
                          type="number"
                          value={param.weight.toFixed(4)}
                          onChange={(e) => handleParamChange(param.index, 'weight', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500 text-xs"
                          step="0.01"
                          min="0"
                          max="1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            全 {gaussianParams.length} 個のガウシアン
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowParams(false)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={updateGaussianParams}
              disabled={loadingParams}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold disabled:opacity-50"
            >
              {loadingParams ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  パラメータを適用
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParamsModal;