import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Square, Loader2, Cpu, Settings, RefreshCw, HelpCircle, X } from 'lucide-react';

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
  const [showHelp, setShowHelp] = useState(false);
  
  // パラメータ
  const [numGaussians, setNumGaussians] = useState(1000);
  const [learningRate, setLearningRate] = useState(0.01);
  const [numSteps, setNumSteps] = useState(10000);
  const [updateInterval, setUpdateInterval] = useState(100);
  const [approximationMethod, setApproximationMethod] = useState('covariance'); // 'variance' or 'covariance'
  const [lossFunction, setLossFunction] = useState('l1_ssim'); // 'l2' or 'l1_ssim'
  
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

  // ログ自動スクロール - 処理ログ内のみでスクロール
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const initializeWithImage = async (file) => {
    setAppState('loading');
    addLog(`画像初期化開始: ガウシアン数=${numGaussians}, 近似方法=${approximationMethod === 'variance' ? '分散' : '分散共分散'}`);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('num_gaussians', numGaussians);
      
      // 近似方法に応じてクラス名を決定
      const className = approximationMethod === 'variance' 
        ? 'GaussianSplatting2D_only_variance' 
        : 'GaussianSplatting2D';
      formData.append('class_name', className);

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
    addLog(`学習開始: ガウシアン数=${numGaussians}, LR=${learningRate}, Steps=${numSteps}, 更新間隔=${updateInterval}, 誤差関数=${lossFunction === 'l2' ? 'L2' : 'L1+SSIM'}`);
    setCurrentStep(0);
    setTotalSteps(numSteps);

    const ws = new WebSocket('ws://localhost:18000/train');
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket接続確立');
      
      // 誤差関数名を決定
      const lossFuncName = lossFunction === 'l2' ? '_calc_loss_l2' : '_calc_loss_l1_ssim';
      
      ws.send(JSON.stringify({
        learning_rate: learningRate,
        num_steps: numSteps,
        update_interval: updateInterval,
        loss_function: lossFuncName
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
      // WebSocket切断時は状態を変更しない（学習完了/中断で既に変更済み）
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
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
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
              <h2 className="text-xl font-semibold mb-2 text-gray-700">
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

        {/* 下段：パラメータ/コントロール + ログ + プログレスバー */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          {/* 左列：パラメータ設定＆学習コントロール */}
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

                {/* ボタン */}
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

          {/* 中央～右列：処理状況（プログレスバー + ログ） */}
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
        </div>

        {/* ヘルプモーダル */}
        {showHelp && (
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
                      <li>「実行」ボタンで最適化計算を開始します（自動的に最新パラメータで再初期化されます）</li>
                      <li>学習中は中央と右側の画像がリアルタイムで更新されます</li>
                      <li>「学習中断」ボタンでいつでも処理を停止できます</li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                    <h4 className="font-semibold text-green-800 mb-2">⚙️ パラメータ説明</h4>
                    <ul className="space-y-2 text-sm">
                      <li><strong>近似方法:</strong> ガウシアンの表現方法（分散のみ or 分散共分散行列）</li>
                      <li><strong>誤差関数:</strong> 学習に使用する損失関数（L2 or L1+SSIM）</li>
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
        )}
      </div>
    </div>
  );
};

export default ImageProcessingApp;