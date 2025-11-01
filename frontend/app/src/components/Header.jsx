// 画面ヘッダー部分のコンポーネント
import React from 'react';
import { HelpCircle, Cpu } from 'lucide-react';

const Header = ({ setShowHelp, deviceInfo, appState }) => {
  const getStateLabel = (state) => {
    switch (state) {
      case 'waiting': return '待機中';
      case 'loading': return '読み込み中';
      case 'loaded': return '準備完了';
      case 'training': return '学習中';
      case 'paused': return '一時停止';
      default: return '不明';
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-800">
          2DGS
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg shadow transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>使い方</span>
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
            <Cpu className="w-4 h-4" />
            <span>デバイス: {deviceInfo || '取得中...'}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow">
            状態: <span className="font-semibold">{getStateLabel(appState)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;