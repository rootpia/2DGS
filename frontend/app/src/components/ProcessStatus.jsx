// 進捗やログ表示などコンポーネント
import React from 'react';

const ProcessStatus = ({ 
  totalSteps, 
  currentStep, 
  currentLoss, 
  logs, 
  logsEndRef 
}) => {
  const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-4">
      <h2 className="text-xl font-semibold mb-3 text-gray-700">
        処理状況
      </h2>
      
      {/* プログレスバー */}
      {totalSteps > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>学習進捗</span>
            <span>{progressPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <div>
              ステップ: <span className="font-semibold">{currentStep} / {totalSteps}</span>
            </div>
            {currentLoss !== null && (
              <div>
                Loss: <span className="font-mono font-semibold">{currentLoss.toFixed(6)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 処理ログ */}
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-600">処理ログ</h3>
        <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs h-64 overflow-y-auto">
          {logs.length > 0 ? (
            <>
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          ) : (
            <div className="text-gray-500 text-center py-8">
              ログはまだありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessStatus;