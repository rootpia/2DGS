import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Square, Loader2, Cpu, Settings, RefreshCw } from 'lucide-react';

const ImageProcessingApp = () => {
  // 状態管理
  const [appState, setAppState] = useState('waiting');
  const [originalImage, setOriginalImage] = useState(null);
  const [predictedImage, setPredictedImage] = useState(null);
  const [pointsImage, setPointsImage] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState('');
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentLoss, setCurrentLoss] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  
  // パラメータ
  const [numGaussians, setNumGaussians] = useState(1000);
  const [learningRate, setLearningRate] = useState(0.01);
  const [numSteps, setNumSteps] = useState(10000);
  
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  // デバイス情報取得
  useEffect(() => {
    fetch('http://localhost:18000/device-info')
      .then(res => res.json())
      .then(data => setDeviceInfo(data.device))
      .catch(err => console.error('デバイス情報取得エラー:', err));
  }, []);

  // ログ自動スクロール
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const initializeWithImage = async (file) => {
    setAppState('loading');
    addLog(`画像初期化開始: ガウシアン数=${numGaussians}`);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('num_gaussians', numGaussians);

      const response = await fetch('http://localhost:18000/initialize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setOriginalImage(`data:image/png;base64,${data.original_image}`);
      setPredictedImage(`data:image/png;base64,${data.predicted_image}`);
      setPointsImage(`data:image/png;base64,${data.points_image}`);
      setAppState('loaded');
      
      addLog(`初期化完了: ${numGaussians}個のガウシアンで初期化`);
      addLog('実行ボタンを押してください');

    } catch (error) {
      console.error('画像初期化エラー:', error);
      addLog(`エラー: ${error.message}`);
      setAppState('waiting');
      alert('画像初期化中にエラーが発生しました。');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCurrentFile(file);
    setLogs([]);
    setCurrentStep(0);
    setTotalSteps(0);
    setCurrentLoss(null);
    event.target.value = '';

    const scrollY = window.scrollY;
    await initializeWithImage(file);
    window.scrollTo(0, scrollY);
  };

  const handleReinitialize = async () => {
    if (!currentFile) return;
    
    const previousState = appState;
    setAppState('loading');
    
    if (previousState === 'loaded') {
      setLogs([]);
    }
    setCurrentStep(0);
    setTotalSteps(0);
    setCurrentLoss(null);
    
    addLog(`パラメータ再適用: ガウシアン数=${numGaussians}`);
    
    const scrollY = window.scrollY;
    
    try {
      const response = await fetch(`http://localhost:18000/reinitialize?num_gaussians=${numGaussians}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setPredictedImage(`data:image/png;base64,${data.predicted_image}`);
      setPointsImage(`data:image/png;base64,${data.points_image}`);
      setAppState('loaded');
      
      addLog(`再初期化完了: ${numGaussians}個のガウシアンで初期化`);

    } catch (error) {
      console.error('再初期化エラー:', error);
      addLog(`エラー: ${error.message}`);
      setAppState('loaded');
      alert('再初期化中にエラーが発生しました。');
    }
    
    window.scrollTo(0, scrollY);
  };

  const startTraining = async () => {
    if (appState !== 'loaded' && appState !== 'paused') return;

    // パラメータが変更されている可能性があるので再初期化
    if (currentFile) {
      addLog(`パラメータ確認: ガウシアン数=${numGaussians}`);
      await handleReinitialize();
    }

    setAppState('training');
    addLog(`学習開始: ガウシアン数=${numGaussians}, LR=${learningRate}, Steps=${numSteps}`);
    setCurrentStep(0);
    setTotalSteps(numSteps);

    const ws = new WebSocket('ws://localhost:18000/ws/train');
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket接続確立');
      ws.send(JSON.stringify({
        learning_rate: learningRate,
        num_steps: numSteps,
        update_interval: 100
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'update') {
        setCurrentStep(data.step);
        setCurrentLoss(data.loss);
        setPredictedImage(`data:image/png;base64,${data.predicted_image}`);
        setPointsImage(`data:image/png;base64,${data.points_image}`);
        addLog(data.message);
      } else if (data.type === 'complete') {
        addLog('学習完了');
        setAppState('paused');
        ws.close();
      } else if (data.type === 'error') {
        addLog(`エラー: ${data.message}`);
        setAppState('paused');
        ws.close();
      } else if (data.type === 'log') {
        addLog(data.message);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
      addLog('WebSocket接続エラー');
      setAppState('paused');
    };

    ws.onclose = () => {
      addLog('WebSocket接続終了');
      if (appState === 'training') {
        setAppState('paused');
      }
    };
  };

  const stopTraining = async () => {
    if (appState !== 'training') return;

    addLog('学習中断リクエスト送信...');
    
    try {
      await fetch('http://localhost:18000/stop', {
        method: 'POST',
      });
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setAppState('paused');
      addLog('学習を中断しました');
    } catch (error) {
      console.error('中断エラー:', error);
      addLog(`中断エラー: ${error.message}`);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const resetApp = () => {
    setAppState('waiting');
    setOriginalImage(null);
    setPredictedImage(null);
    setPointsImage(null);
    setLogs([]);
    setCurrentStep(0);
    setTotalSteps(0);
    setCurrentLoss(null);
    setCurrentFile(null);
  };

  const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-gray-800">
              2DGS
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
                <Cpu className="w-4 h-4" />
                <span>デバイス: {deviceInfo || '取得中...'}</span>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg shadow">
                状態: <span className="font-semibold">{
                  appState === 'waiting' ? '待機中' :
                  appState === 'loading' ? '読み込み中' :
                  appState === 'loaded' ? '準備完了' :
                  appState === 'training' ? '学習中' :
                  appState === 'paused' ? '一時停止' : '不明'
                }</span>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ：3列レイアウト */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左列：オリジナル画像 */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
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
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">
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
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">
                Gaussian Points
              </h2>
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

        {/* 下段：パラメータ/コントロール + ログ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* 左列：パラメータ設定＆学習コントロール */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              パラメータ設定
            </h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ガウシアン数
                </label>
                <input
                  type="number"
                  value={numGaussians}
                  onChange={(e) => setNumGaussians(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="5000"
                  step="100"
                  disabled={appState === 'training'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  学習率
                </label>
                <input
                  type="number"
                  value={learningRate}
                  onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  disabled={appState === 'training'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  学習ステップ数
                </label>
                <input
                  type="number"
                  value={numSteps}
                  onChange={(e) => setNumSteps(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="100"
                  max="50000"
                  step="100"
                  disabled={appState === 'training'}
                />
              </div>
            </div>
            
            {/* 再初期化ボタン */}
            {(appState === 'loaded' || appState === 'paused') && (
              <button
                onClick={handleReinitialize}
                className="w-full mb-4 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                disabled={appState === 'training'}
              >
                <RefreshCw className="w-4 h-4" />
                パラメータを適用して再初期化
              </button>
            )}

            {/* 学習コントロール */}
            {(appState === 'loaded' || appState === 'training' || appState === 'paused') && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">
                  学習コントロール
                </h3>
                
                {/* プログレスバー */}
                {totalSteps > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>学習進捗</span>
                      <span>{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    {currentLoss !== null && (
                      <div className="mt-2 text-sm text-gray-600">
                        Loss: <span className="font-mono font-semibold">{currentLoss.toFixed(6)}</span>
                      </div>
                    )}
                    {totalSteps > 0 && (
                      <div className="mt-1 text-sm text-gray-600">
                        進捗: <span className="font-semibold">{currentStep} / {totalSteps}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ボタン */}
                <div className="space-y-2">
                  {appState === 'loaded' || appState === 'paused' ? (
                    <button
                      onClick={startTraining}
                      className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
                    >
                      <Play className="w-5 h-5" />
                      実行
                    </button>
                  ) : (
                    <button
                      onClick={stopTraining}
                      className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
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

          {/* 中央～右列：処理ログ（2列分） */}
          {logs.length > 0 && (
            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700">
                処理ログ
              </h2>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* 説明 */}
        {appState === 'waiting' && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">使い方</h3>
            <div className="text-sm text-blue-700 space-y-2">
              <p>1. パラメータを設定してください（ガウシアン数、学習率、ステップ数）</p>
              <p>2. 画像をアップロードすると、GaussianSplattingの初期化が行われます</p>
              <p>3. 「実行」ボタンで最適化計算を開始します（自動的に最新パラメータで再初期化されます）</p>
              <p>4. 学習中は中央と右側の画像がリアルタイムで更新されます</p>
              <p>5. 「学習中断」ボタンでいつでも処理を停止できます</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageProcessingApp;