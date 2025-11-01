// 使い方表示のコンポーネント
import React from 'react';
import { HelpCircle, X } from 'lucide-react';

const HelpModal = ({ showHelp, setShowHelp }) => {
  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-500" />
            使い方
          </h3>
          <button
            onClick={() => setShowHelp(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4 text-gray-700">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h4 className="font-semibold text-blue-800 mb-2">📝 基本的な流れ</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>パラメータを設定してください（ガウシアン数、学習率、ステップ数、更新間隔）</li>
                <li>画像をアップロードすると、GaussianSplattingの初期化が行われます</li>
                <li>「実行」ボタンで最適化計算を開始します</li>
                <li>学習中は中央と右側の画像がリアルタイムで更新されます</li>
                <li>「学習中断」ボタンでいつでも処理を停止できます</li>
              </ol>
            </div>
            
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <h4 className="font-semibold text-green-800 mb-2">⚙️ パラメータ説明</h4>
              <ul className="space-y-2 text-sm">
                <li><strong>近似方法:</strong> ガウシアンの表現方法（分散のみ or 分散共分散行列）</li>
                <li><strong>誤差関数:</strong> 学習に使用する損失関数（L2 or L1+SSIM or MSE）</li>
                <li><strong>ガウシアン数:</strong> 画像を近似するガウシアン点の数（多いほど精密だが計算時間が増加）</li>
                <li><strong>学習率:</strong> 最適化の更新幅（大きいほど速いが不安定になる可能性）</li>
                <li><strong>学習ステップ数:</strong> 最適化の反復回数（多いほど精度が向上）</li>
                <li><strong>画面更新間隔:</strong> 何ステップごとに画面を更新するか（小さいほど頻繁に更新）</li>
              </ul>
            </div>
            
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
              <h4 className="font-semibold text-purple-800 mb-2">🎯 表示画像の説明</h4>
              <ul className="space-y-2 text-sm">
                <li><strong>Original Image:</strong> アップロードされた元画像</li>
                <li><strong>Predicted Image:</strong> ガウシアンで近似された予測画像</li>
                <li><strong>Gaussian Points:</strong> 各ガウシアンの中心位置を赤点で表示</li>
              </ul>
            </div>
            
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded">
              <h4 className="font-semibold text-indigo-800 mb-2">📊 パラメータ表示機能</h4>
              <ul className="space-y-2 text-sm">
                <li><strong>パラメタ編集:</strong> 「パラメタ編集」ボタンで現在のガウシアンパラメタを確認・編集できます</li>
                <li><strong>エクスポート:</strong> 「エクスポート」ボタンでパラメータをCSVファイルとして保存できます</li>
                <li><strong>インポート:</strong> 「インポート」ボタンで保存したCSVファイルを読み込んで復元できます</li>
                <li><strong>即座に反映:</strong> インポート後は自動的に画像が更新され、ガウシアン数も設定に反映されます</li>
              </ul>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <h4 className="font-semibold text-yellow-800 mb-2">💡 Tips</h4>
              <ul className="space-y-2 text-sm">
                <li>パラメータ変更後は「再初期化」ボタンで即座に反映できます</li>
                <li>学習中でも「学習中断」でいつでも停止可能です</li>
                <li>処理ログで学習の進捗とLoss値を確認できます</li>
                <li>GPU使用時は大幅に高速化されます（デバイス情報を確認）</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowHelp(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;