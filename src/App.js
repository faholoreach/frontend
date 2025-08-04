import React, { useState, useEffect, useRef } from 'react';
import './App.css';

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
  const [qrData, setQrData] = useState('https://www.google.com'); // QR코드 데이터 상태 추가
  
  const [satoStatus, setSatoStatus] = useState({ message: '대기 중...', status: 'pending' });
  const [zebraStatus, setZebraStatus] = useState({ message: '대기 중...', status: 'pending' });
  
  const socketRef = useRef(null);
  const zebraDeviceList = useRef([]);
  const pendingSatoPrintJob = useRef(null);

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

  const getZebraPrinterList = () => {
    setZebraStatus({ message: 'SDK 로드 확인 중...', status: 'pending' });
    if (!window.BrowserPrint) {
      console.warn("BrowserPrint SDK가 로드되지 않았습니다.");
      setZebraStatus({ message: 'SDK를 찾을 수 없습니다.', status: 'error' });
      return;
    }
    
    setZebraStatus({ message: '프린터 목록 요청 중...', status: 'pending' });
    window.BrowserPrint.getLocalDevices(
      (deviceList) => {
        zebraDeviceList.current = deviceList;
        const formattedList = deviceList.map(device => ({
          value: `ZEBRA_${device.uid}`,
          label: `ZEBRA: ${device.name}`,
          uid: device.uid
        }));
        setZebraPrinters(formattedList);
        setZebraStatus({ message: `프린터 ${formattedList.length}대 발견`, status: 'success' });
      },
      () => {
        console.error("로컬 프린터를 가져오는 데 실패했습니다.");
        setZebraStatus({ message: '프린터를 가져오는데 실패했습니다.', status: 'error' });
      },
      "printer"
    );
  };

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
      // sbplCommand += ESC + '%0' + ESC + 'H0550' + ESC + 'V0200' + ESC + 'L0101' + ESC + 'P01' + ESC + 'K1B가나다';
      sbplCommand += ESC + `Q${printQuantity}`;
      sbplCommand += ESC + 'Z';
      const base64Data = btoa(sbplCommand);
      const printJob = {
        "Method": "Driver.SendRawData",
        "Parameters": { "DriverName": printerInfo.driverName, "Data": base64Data }
      };
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
        // QR코드 SBPL 명령어: 2D30,모델,확대율,에러정정레벨,데이터
        let sbplCommand = '';
        sbplCommand += ESC + 'A'; // 인쇄 시작
        sbplCommand += ESC + 'A3H001V001'; // 인쇄 기준 위치 설정
        sbplCommand += ESC + '%0' + ESC + 'H0500' + ESC + 'V0050' + ESC + 'L0101' + ESC + 'P01' + ESC + 'XM1234567890'; // 텍스트 인쇄
        sbplCommand += ESC + 'H0500' + ESC + 'V0120' + ESC + `BQ2,M2,L,${qrData}`;
        // sbplCommand += ESC + '%2' + ESC + 'H0500' + ESC + 'V0120' + ESC + `2D30,L,02,0,${qrData.length},${qrData}`;
        sbplCommand += ESC + `Q${printQuantity}`; // 인쇄 매수 설정
        sbplCommand += ESC + 'Z'; // 인쇄 종료
        // let sbplCommand = `${ESC}A${ESC}H0100${ESC}V0100${ESC}BQ3010,112345${qrData}${ESC}Q${printQuantity}${ESC}Z`;
        const base64Data = btoa(sbplCommand);
        const printJob = {
            "Method": "Driver.SendRawData",
            "Parameters": { "DriverName": printerInfo.driverName, "Data": base64Data }
        };
        sendSatoJob(printJob);
    } else if (selectedPrinter.startsWith('ZEBRA_')) {
        // QR코드 ZPL 명령어: ^BQN,2,크기^FD데이터^FS
        const zplData = `^XA^FO50,50^BQN,2,4^FDQA,${qrData}^FS^XZ`;
        sendZebraJob(zplData);
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
            () => setZebraStatus({ message: `인쇄 성공! (${i + 1}/${printQuantity})`, status: 'success' }),
            (error) => setZebraStatus({ message: `인쇄 오류: ${error}`, status: 'error' })
          );
      }
    } else {
      setZebraStatus({ message: '선택된 장치를 찾을 수 없습니다.', status: 'error' });
    }
  };


  useEffect(() => {
    setupSatoSocket();
    getZebraPrinterList();

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const combinedPrinters = [...satoPrinters, ...zebraPrinters];
    setPrinters(combinedPrinters);

    if (combinedPrinters.length > 0) {
      const isSelectedPrinterValid = combinedPrinters.some(p => p.value === selectedPrinter);
      if (!selectedPrinter || !isSelectedPrinterValid) {
        setSelectedPrinter(combinedPrinters[0].value);
      }
    }
  }, [satoPrinters, zebraPrinters]);

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
        </div>
        <div style={{ marginBottom: '20px', width: '300px' }}>
            <label htmlFor="qrData" style={{ marginRight: '10px' }}>QR 데이터:</label>
            <input
                id="qrData"
                type="text"
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                style={{ padding: '8px', width: '200px', borderRadius: '4px' }}
            />
        </div>
        <div style={{display: 'flex', gap: '10px'}}>
            <button 
              onClick={handlePrintTest} 
              disabled={!selectedPrinter}
              style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: '#61dafb', color: '#282c34', fontSize: '16px' }}
            >
              텍스트/바코드 테스트
            </button>
            <button 
              onClick={handlePrintQRTest} 
              disabled={!selectedPrinter}
              style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: '#61dafb', color: '#282c34', fontSize: '16px' }}
            >
              QR코드 테스트 인쇄
            </button>
        </div>
      </header>
    </div>
  );
}

export default App;
