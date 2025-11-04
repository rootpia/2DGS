import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ImageDisplay from './components/ImageDisplay';
import ParameterSettings from './components/ParameterSettings';
import ProcessStatus from './components/ProcessStatus';
import ParamsModal from './components/ParamsModal';
import HelpModal from './components/HelpModal';

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
  const [showParams, setShowParams] = useState(false);
  const [gaussianParams, setGaussianParams] = useState([]);
  const [hasCovariance, setHasCovariance] = useState(true);
  const [loadingParams, setLoadingParams] = useState(false);
  
  // パラメタ
  const [numGaussians, setNumGaussians] = useState(1000);
  const [learningRate, setLearningRate] = useState(0.01);
  const [numSteps, setNumSteps] = useState(10000);
  const [updateInterval, setUpdateInterval] = useState(100);
  const [approximationMethod, setApproximationMethod] = useState('covariance');
  const [lossFunction, setLossFunction] = useState('l1_ssim');
  
  const fileInputRef = useRef(null);
  const wsRef = useRef(null);
  const logsEndRef = useRef(null);

  // backend APIのURL取得
  const createWebSocketUrl = (url) => {
    if (url.startsWith('https')) {
      return url.replace('https', 'wss');
    } else if (url.startsWith('http')) {
      return url.replace('http', 'ws');
    }
    return url; 
  };
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const WS_BACKEND_URL = createWebSocketUrl(BACKEND_URL);
  
  // デバイス情報取得
  useEffect(() => {
    fetch(`${BACKEND_URL}/device-info`)
      .then(res => res.json())
      .then(data => setDeviceInfo(data.device))
      .catch(err => console.error('デバイス情報取得エラー:', err));
  }, []);

  // ログ自動スクロール
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // ガウシアンパラメタ取得
  const loadGaussianParams = async () => {
    setLoadingParams(true);
    try {
      const response = await fetch(`${BACKEND_URL}/get-params`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setGaussianParams(data.params);
      setHasCovariance(data.has_covariance);
      addLog(`パラメタを読み込みました: ${data.num_gaussians}個のガウシアン`);
    } catch (error) {
      console.error('パラメタ取得エラー:', error);
      addLog(`パラメタ取得エラー: ${error.message}`);
      alert('パラメタの取得に失敗しました。');
    } finally {
      setLoadingParams(false);
    }
  };

  // ガウシアンパラメタ更新
  const updateGaussianParams = async () => {
    setLoadingParams(true);
    try {
      const response = await fetch(`${BACKEND_URL}/update-params`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params: gaussianParams }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPredictedImage(`data:image/png;base64,${data.predicted_image}`);
      setPointsImage(`data:image/png;base64,${data.points_image}`);
      addLog(`パラメタを更新しました: ${data.num_gaussians}個のガウシアン`);
      setShowParams(false);
    } catch (error) {
      console.error('パラメタ更新エラー:', error);
      addLog(`パラメタ更新エラー: ${error.message}`);
      alert('パラメタの更新に失敗しました。');
    } finally {
      setLoadingParams(false);
    }
  };

  // パラメタ編集画面のパラメタ変更
  const handleParamChange = (index, field, value) => {
    setGaussianParams(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: parseFloat(value) };
      return updated;
    });
  };

  // パラメタのCSVエクスポート
  const exportParamsAsCSV = () => {
    let csv = hasCovariance 
      ? 'index,mean_x,mean_y,sigma_x,sigma_y,sigma_xy,weight\n'
      : 'index,mean_x,mean_y,sigma_x,sigma_y,weight\n';
    
    gaussianParams.forEach(param => {
      csv += hasCovariance
        ? `${param.index},${param.mean_x},${param.mean_y},${param.sigma_x},${param.sigma_y},${param.sigma_xy},${param.weight}\n`
        : `${param.index},${param.mean_x},${param.mean_y},${param.sigma_x},${param.sigma_y},${param.weight}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gaussian_params.csv';
    a.click();
    URL.revokeObjectURL(url);
    addLog('パラメタをCSVファイルにエクスポートしました');
  };

  // パラメタのCSVインポート
  const importParamsFromCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');
        
        const hasSigmaXY = headers.includes('sigma_xy');
        
        const params = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length < 6) continue;
          
          const param = {
            index: parseInt(values[0]),
            mean_x: parseFloat(values[1]),
            mean_y: parseFloat(values[2]),
            sigma_x: parseFloat(values[3]),
            sigma_y: parseFloat(values[4]),
            weight: parseFloat(values[hasSigmaXY ? 6 : 5])
          };
          
          if (hasSigmaXY) {
            param.sigma_xy = parseFloat(values[5]);
          }
          
          params.push(param);
        }
        
        if (params.length === 0) {
          throw new Error('有効なパラメタが見つかりませんでした');
        }
        
        setGaussianParams(params);
        setHasCovariance(hasSigmaXY);
        
        setLoadingParams(true);
        const response = await fetch(`${BACKEND_URL}/update-params`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ params }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setPredictedImage(`data:image/png;base64,${data.predicted_image}`);
        setPointsImage(`data:image/png;base64,${data.points_image}`);
        
        setNumGaussians(params.length);
        
        addLog(`CSVファイルからパラメタをインポートしました: ${params.length}個のガウシアン`);
        setShowParams(false);
        
      } catch (error) {
        console.error('CSVインポートエラー:', error);
        addLog(`CSVインポートエラー: ${error.message}`);
        alert('CSVファイルの読み込みに失敗しました。');
      } finally {
        setLoadingParams(false);
      }
    };
    
    reader.readAsText(file);
    event.target.value = '';
  };

  // 画像ファイルから初期化
  const initializeWithImage = async (file) => {
    setAppState('loading');
    addLog(`初期化開始: 近似方法=${approximationMethod === 'variance' ? '分散' : '分散共分散'}, ガウシアン数=${numGaussians}`);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('num_gaussians', numGaussians);
      
      const className = approximationMethod === 'variance' 
        ? 'GaussianSplatting2D_only_variance' 
        : 'GaussianSplatting2D';
      formData.append('class_name', className);

      const response = await fetch(`${BACKEND_URL}/initialize`, {
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

  // 画像アップロード
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

  // 再初期化（画像はそのまま再利用）
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
    
    addLog(`パラメタ再適用: 近似方法=${approximationMethod === 'variance' ? '分散' : '分散共分散'}, ガウシアン数=${numGaussians}`);
    
    const scrollY = window.scrollY;
    const className = approximationMethod === 'variance' 
      ? 'GaussianSplatting2D_only_variance' 
      : 'GaussianSplatting2D';

    try {
      const response = await fetch(`${BACKEND_URL}/reinitialize?class_name=${className}&num_gaussians=${numGaussians}`, {
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

  // 最適化処理：実行
  const startTraining = async () => {
    if (appState !== 'loaded' && appState !== 'paused') return;

    setAppState('training');
    addLog(`学習開始: 近似方法=${approximationMethod === 'variance' ? '分散' : '分散共分散'}, 誤差関数=${lossFunction === 'l2' ? 'L2' : lossFunction === 'mse' ? 'MSE' : 'L1+SSIM'}, ガウシアン数=${numGaussians}, LR=${learningRate}, Steps=${numSteps}, 更新間隔=${updateInterval}`);
    setCurrentStep(0);
    setTotalSteps(numSteps);

    const ws = new WebSocket(`${WS_BACKEND_URL}/train`);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket接続確立');
      
      const lossFuncName = 
        lossFunction === 'l2' ? '_calc_loss_l2' : 
        lossFunction === 'l1_ssim' ? '_calc_loss_l1_ssim' : 
        '_calc_loss_mse';
      
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
    };
  };

  // 最適化処理：中断
  const stopTraining = async () => {
    if (appState !== 'training') return;

    addLog('学習中断リクエスト送信...');
    
    try {
      await fetch(`${BACKEND_URL}/stop`, {
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

  // ボタンクリック：画像アップロード
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // ボタンクリック：アプリリセット
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

  // ボタンクリック：パラメタ編集ボタン
  const handleShowParams = () => {
    setShowParams(true);
    loadGaussianParams();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="max-w-7xl mx-auto">
        <Header 
          setShowHelp={setShowHelp}
          deviceInfo={deviceInfo}
          appState={appState}
        />

        <ImageDisplay 
          originalImage={originalImage}
          predictedImage={predictedImage}
          pointsImage={pointsImage}
          appState={appState}
          handleUploadClick={handleUploadClick}
          onShowParams={handleShowParams}
          fileInputRef={fileInputRef}
          handleImageUpload={handleImageUpload}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <ParameterSettings 
            appState={appState}
            approximationMethod={approximationMethod}
            setApproximationMethod={setApproximationMethod}
            lossFunction={lossFunction}
            setLossFunction={setLossFunction}
            numGaussians={numGaussians}
            setNumGaussians={setNumGaussians}
            learningRate={learningRate}
            setLearningRate={setLearningRate}
            numSteps={numSteps}
            setNumSteps={setNumSteps}
            updateInterval={updateInterval}
            setUpdateInterval={setUpdateInterval}
            handleReinitialize={handleReinitialize}
            startTraining={startTraining}
            stopTraining={stopTraining}
            resetApp={resetApp}
          />

          <ProcessStatus 
            totalSteps={totalSteps}
            currentStep={currentStep}
            currentLoss={currentLoss}
            logs={logs}
            logsEndRef={logsEndRef}
          />
        </div>

        <ParamsModal 
          showParams={showParams}
          setShowParams={setShowParams}
          gaussianParams={gaussianParams}
          hasCovariance={hasCovariance}
          loadingParams={loadingParams}
          handleParamChange={handleParamChange}
          updateGaussianParams={updateGaussianParams}
          exportParamsAsCSV={exportParamsAsCSV}
          importParamsFromCSV={importParamsFromCSV}
        />

        <HelpModal 
          showHelp={showHelp}
          setShowHelp={setShowHelp}
        />
      </div>
    </div>
  );
};

export default ImageProcessingApp;