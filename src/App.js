import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { useBrowserPrintLoader } from './common/printer/useBrowserPrintLoader';
import PrinterStatus from './PrinterStatus';

// SATO 프린터 웹소켓 URL
const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

// 상태 표시를 위한 컴포넌트
const StatusDisplay = ({ satoStatus, zebraStatus }) => {
  const getStatusIndicator = (status) => {
    switch (status) {
      case 'success':
        return <span style={{ color: 'green', marginRight: '8px' }}>●</span>;
      case 'error':
        return <span style={{ color: 'red', marginRight: '8px' }}>●</span>;
      case 'pending':
      default:
        return <span style={{ color: 'orange', marginRight: '8px' }}>●</span>;
    }
  };

  return (
    <div style={{ border: '1px solid #555', borderRadius: '8px', padding: '15px', minWidth: '300px', marginBottom: '20px', textAlign: 'left', fontSize: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
        {getStatusIndicator(satoStatus.status)}
        <span>SATO 프린터: {satoStatus.message}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {getStatusIndicator(zebraStatus.status)}
        <span>ZEBRA 프린터: {zebraStatus.message}</span>
      </div>
    </div>
  );
};


function App() {
  const [satoPrinters, setSatoPrinters] = useState([]);
  const [zebraPrinters, setZebraPrinters] = useState([]);
  const [printers, setPrinters] = useState([]);
  
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printQuantity, setPrintQuantity] = useState(1);
  const [printText, setPrintText] = useState('');
  const [hex, setHex] = useState('');
  const [qrData, setQrData] = '0123456789'; 
  
  const [satoStatus, setSatoStatus] = useState({ message: '대기 중...', status: 'pending' });
  const [zebraStatus, setZebraStatus] = useState({ message: '대기 중...', status: 'pending' });
  
  const socketRef = useRef(null);
  const zebraDeviceList = useRef([]);
  const pendingSatoPrintJob = useRef(null);

  const {
      loading: zebraLoading,
      loaded: zebraLoaded,
      error: zebraError,
      loadStatus,
      testResult,
      loadLibrary,
      testConnection,
      refreshStatus
  } = useBrowserPrintLoader();

  // ZEBRA 프린터 상태를 업데이트하는 useEffect
  useEffect(() => {
    if (zebraError) {
      setZebraStatus({ message: `오류: ${zebraError}`, status: 'error' });
    } else if (zebraLoading) {
      setZebraStatus({ message: 'Zebra 프린터 확인 중...', status: 'pending' });
    } else if (zebraLoaded) {
      if (testResult) { // testResult가 있으면
        if (testResult.success && Array.isArray(testResult.devices)) {
          // 성공
          const deviceList = testResult.devices;
          zebraDeviceList.current = deviceList;
          const formattedList = deviceList.map(device => ({
            value: `ZEBRA_${device.uid}`,
            label: `ZEBRA: ${device.name}`,
            uid: device.uid
          }));
          setZebraPrinters(formattedList);
          setZebraStatus({ message: `프린터 ${formattedList.length}대 발견`, status: 'success' });
        } else {
          // 테스트 실패
          setZebraStatus({ message: `연결 실패: ${testResult.message}`, status: 'error' });
        }
      } else {
        // 라이브러리는 로드되었지만 아직 테스트 결과는 없는 상태
        setZebraStatus({ message: '라이브러리 로드 완료. 연결 테스트 중...', status: 'pending' });
      }
    } else {
      // 초기 상태
      setZebraStatus({ message: '대기 중...', status: 'pending' });
    }
  }, [zebraLoading, zebraLoaded, zebraError, testResult]);


  const setupSatoSocket = () => {
    if (socketRef.current && socketRef.current.readyState < 2) return;

    setSatoStatus({ message: '서버에 연결하는 중...', status: 'pending' });
    const socket = new WebSocket(SATO_WEBSOCKET_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("SATO WebSocket Connection established.");
      setSatoStatus({ message: '연결 성공. 목록 요청 중...', status: 'pending' });
      
      if (pendingSatoPrintJob.current) {
        socket.send(JSON.stringify(pendingSatoPrintJob.current));
        pendingSatoPrintJob.current = null;
      } else {
        const getListJob = { "Method": "Driver.GetDriverList" };
        socket.send(JSON.stringify(getListJob));
      }
    };

    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (Array.isArray(response)) {
          const formattedList = response.map(printer => ({
            value: `SATO_${printer.PortName}`,
            label: `SATO: ${printer.DriverName}`,
            driverName: printer.DriverName,
            portName: printer.PortName,
          }));
          setSatoPrinters(formattedList);
          setSatoStatus({ message: `프린터 ${formattedList.length}대 발견`, status: 'success' });
        } 
        else if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
          setSatoStatus({ message: '인쇄 성공!', status: 'success' });
        } else if (response.Error) {
          setSatoStatus({ message: `오류: ${response.Error}`, status: 'error' });
        }
      } catch (e) {
         if (event.data.toLowerCase() === "true") {
          setSatoStatus({ message: '인쇄 성공!', status: 'success' });
        } else {
          console.log("Received non-JSON message from SATO:", event.data);
        }
      }
    };

    socket.onclose = (event) => {
      if (!event.wasClean && satoStatus.status !== 'success') {
        setSatoStatus({ message: '연결이 끊어졌습니다.', status: 'error' });
      }
      console.log("SATO WebSocket Connection closed.");
      socketRef.current = null;
    };

    socket.onerror = (error) => {
      setSatoStatus({ message: '연결 오류.', status: 'error' });
      console.error("SATO WebSocket Error:", error);
      socketRef.current = null;
    };
  };

  const encodingTest = (printText) => {
    const Iconv = require('iconv-lite');
    const tempText = '제조일자';
    const buffer = Iconv.encode(tempText, 'euc-kr');
    let hexString = '';
    for (let i = 0; i < buffer.length; i++) {
      hexString += buffer[i].toString(16).padStart(2, '0');
    }
    setHex(hexString);
  }

  const handlePrintTest = () => {
    const printerInfo = printers.find(p => p.value === selectedPrinter);
    if (!printerInfo) {
      alert("선택된 프린터 정보를 찾을 수 없습니다.");
      return;
    }

    if (selectedPrinter.startsWith('SATO_')) {
      const ESC = '\x1B';
      let sbplCommand = '';
      sbplCommand += ESC + 'A';
      sbplCommand += ESC + 'A3H001V001';
      sbplCommand += ESC + '%0' + ESC + 'H0500' + ESC + 'V0050' + ESC + 'L0101' + ESC + 'P01' + ESC + 'XM1234567890';
      sbplCommand += ESC + '%0' + ESC + 'H0500' + ESC + 'V0120' + ESC + 'BG020501234567890';
      sbplCommand += ESC + '%0' + ESC + 'H0550' + ESC + 'V0170' + ESC + 'BD102050*1234567890*';
      sbplCommand += ESC + '%0' + ESC + 'H0550' + ESC + 'V0170' + ESC + 'BC02050101234567890';
      sbplCommand += ESC + `Q${printQuantity}`;
      sbplCommand += ESC + 'Z';
      const base64Data = btoa(sbplCommand);
      const printJob = {
        "Method": "Driver.SendRawData",
        "Parameters": { "DriverName": printerInfo.driverName, "Data": base64Data }
      };
      console.log(printJob);
      sendSatoJob(printJob);
    } else if (selectedPrinter.startsWith('ZEBRA_')) {
      let zplCommand = '';
      zplCommand += '^XA'; // 인쇄 시작
      zplCommand += '^FO50,50^A0N,28,28^FDZEBRA Print Test^FS'; // 텍스트
      zplCommand += '^FO50,100^BY2^BCN,100,Y,N,N^FD1234567890^FS'; // 바코드
      zplCommand += '^XZ'; // 인쇄 종료
      sendZebraJob(zplCommand);
    }
  };

  const handlePrintQRTest = () => {
    const printerInfo = printers.find(p => p.value === selectedPrinter);
    if (!printerInfo) {
      alert("선택된 프린터 정보를 찾을 수 없습니다.");
      return;
    }

    if (selectedPrinter.startsWith('SATO_')) {
        const ESC = '\x1B';
        let sbplCommand = '';
        sbplCommand += ESC + 'A'; 
        sbplCommand += ESC + 'A3H001V001'; 
        sbplCommand += ESC + '%0' + ESC + 'H0500' + ESC + 'V0050' + ESC + 'L0101' + ESC + 'P01' + ESC + 'XM1234567890'; 
        sbplCommand += ESC + 'V0100' + ESC + 'H0500' + ESC + `2D20,2,003,081,123456789`;
        sbplCommand += ESC + `DS0010,${qrData}`;
        sbplCommand += ESC + 'Q1';
        sbplCommand += ESC + 'Z';
        const base64Data = btoa(sbplCommand);
        const printJob = {
            "Method": "Driver.SendRawData",
            "Parameters": { "DriverName": printerInfo.driverName, "Data": base64Data }
        };
        sendSatoJob(printJob);
    } else if (selectedPrinter.startsWith('ZEBRA_')) {
        let zplCommand = '';
        zplCommand += '^XA'; 
        zplCommand += '^FO50,50^A0N,28,28^FDZEBRA Print Test^FS';
        zplCommand += `^FO50,50^BQN,2,4^FDQA,${qrData}^FS`;
        zplCommand += '^XZ'; 
        sendZebraJob(zplCommand);
    }
  };

  const sendSatoJob = (printJob) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setSatoStatus({ message: '재연결 후 인쇄합니다...', status: 'pending' });
      pendingSatoPrintJob.current = printJob;
      setupSatoSocket();
      return;
    }
    setSatoStatus({ message: '인쇄 명령 전송 중...', status: 'pending' });
    socketRef.current.send(JSON.stringify(printJob));
  };

  const sendZebraJob = (zplData) => {
    const printerInfo = printers.find(p => p.value === selectedPrinter);
    const selectedDevice = zebraDeviceList.current.find(device => device.uid === printerInfo.uid);
    if (selectedDevice) {
      setZebraStatus({ message: '인쇄 명령 전송 중...', status: 'pending' });
      for (let i = 0; i < printQuantity; i++) {
          selectedDevice.send(zplData,
            () => setZebraStatus({ message: `인쇄 성공! (${printQuantity})`, status: 'success' }),
            (error) => setZebraStatus({ message: `인쇄 오류: ${error}`, status: 'error' })
          );
      }
    } else {
      setZebraStatus({ message: '선택된 장치를 찾을 수 없습니다.', status: 'error' });
    }
  };

  useEffect(() => {
    // 컴포넌트가 처음 마운트될 때 프린터 설정을 초기화합니다.
    // SATO 프린터 소켓을 설정하고 ZEBRA 프린터 라이브러리를 로드합니다.
    setupSatoSocket();
    loadLibrary().then(() => {
        testConnection();
    });

    return () => {
      // 컴포넌트가 언마운트될 때 웹소켓 연결을 정리합니다.
      if (socketRef.current && socketRef.current.readyState < 2) { // CONNECTING or OPEN
        socketRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 이 useEffect는 처음 렌더링 시 한 번만 실행됩니다.

  useEffect(() => {
    const combinedPrinters = [...satoPrinters, ...zebraPrinters];
    setPrinters(combinedPrinters);

    if (combinedPrinters.length > 0) {
      const isSelectedPrinterValid = combinedPrinters.some(p => p.value === selectedPrinter);
      if (!selectedPrinter || !isSelectedPrinterValid) {
        setSelectedPrinter(combinedPrinters[0].value);
      }
    }
  }, [satoPrinters, zebraPrinters, selectedPrinter]);
  
  // 인쇄 버튼 스타일
  const printButtonStyle = {
    padding: '10px 20px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#28a745', // '연결 테스트' 버튼과 동일한 녹색
    color: 'white',
    fontSize: '16px'
  };
  const printTextChange = (event) => {
    setPrintText(event.target.value);
  };

  return (
    
    <div className="App">
      <header className="App-header">
        <h2>프린터 연결 상태</h2>
        <StatusDisplay satoStatus={satoStatus} zebraStatus={zebraStatus} />
        <h2>프린터 선택</h2>
        <select
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          disabled={printers.length === 0}
          style={{ marginBottom: '20px', padding: '8px', minWidth: '300px', borderRadius: '4px' }}
        >
          {printers.length === 0 ? (
            <option value="">사용 가능한 프린터 없음</option>
          ) : (
            printers.map((printer) => (
              <option key={printer.value} value={printer.value}>
                {printer.label}
              </option>
            ))
          )}
        </select>
        <div style={{ marginBottom: '10px', width: '300px' }}>
          <label htmlFor="quantity" style={{ marginRight: '10px' }}>인쇄 매수:</label>
          <input
            id="quantity"
            type="number"
            value={printQuantity}
            onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value, 10)))}
            min="1"
            style={{ padding: '8px', width: '80px', borderRadius: '4px' }}
          />
          <input
            type="text"
            value={printText}
            onChange={printTextChange}
            style={{ padding: '8px', width: '80px', borderRadius: '4px' }}
          />
          <button 
              onClick={encodingTest} 
              style={printButtonStyle}
            >
              인코딩 테스트
            </button>
            <p>Hex: {hex}</p>
        </div>
        <div style={{display: 'flex', gap: '10px'}}>
            <button 
              onClick={handlePrintTest} 
              disabled={!selectedPrinter}
              style={printButtonStyle}
            >
              텍스트/바코드 테스트
            </button>
            <button 
              onClick={handlePrintQRTest} 
              disabled={!selectedPrinter}
              style={printButtonStyle}
            >
              QR코드 테스트 인쇄
            </button>
        </div>
        
        <div>
          <PrinterStatus
            loading={zebraLoading}
            loaded={zebraLoaded}
            error={zebraError}
            loadStatus={loadStatus}
            testResult={testResult}
            loadLibrary={loadLibrary}
            testConnection={testConnection}
            refreshStatus={refreshStatus}
          />
        </div>
      </header>
    </div>
    
  );
}

export default App;
