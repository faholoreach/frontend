import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// SATO 프린터 웹소켓 URL
const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

function App() {
  // 개별 프린터 목록과 합쳐진 목록을 위한 상태
  const [satoPrinters, setSatoPrinters] = useState([]);
  const [zebraPrinters, setZebraPrinters] = useState([]);
  const [printers, setPrinters] = useState([]);
  
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [status, setStatus] = useState({ message: '프린터를 찾는 중...', color: 'orange' });
  const socketRef = useRef(null);
  const zebraDeviceList = useRef([]); // ZEBRA 장치 전체 목록 저장
  const pendingSatoPrintJob = useRef(null); // SATO 인쇄 대기열

  // SATO 웹소켓 연결 및 이벤트 핸들러 설정
  const setupSatoSocket = () => {
    // 이미 연결이 설정되어 있거나 연결 중이면 중복 실행 방지
    if (socketRef.current && socketRef.current.readyState < 2) return;

    setStatus({ message: 'SATO 프린터 서버에 연결을 시도합니다...', color: 'orange' });
    const socket = new WebSocket(SATO_WEBSOCKET_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("SATO WebSocket Connection established.");
      setStatus({ message: 'SATO 프린터에 연결되었습니다.', color: 'green' });
      
      // 대기 중인 인쇄 작업이 있으면 실행
      if (pendingSatoPrintJob.current) {
        console.log("Sending pending SATO print job:", pendingSatoPrintJob.current);
        socket.send(JSON.stringify(pendingSatoPrintJob.current));
        pendingSatoPrintJob.current = null; // 대기열 비우기
      } else {
        // 초기 연결 시 프린터 목록 요청
        const getListJob = { "Method": "Driver.GetDriverList" };
        socket.send(JSON.stringify(getListJob));
      }
    };

    socket.onmessage = (event) => {
      console.log(`[SATO Message from Server] ${event.data}`);
      try {
        const response = JSON.parse(event.data);
        // 응답이 배열이면 프린터 목록으로 간주
        if (Array.isArray(response)) {
          const formattedList = response.map(printer => ({
            value: `SATO_${printer.PortName}`,
            label: `SATO: ${printer.DriverName}`,
            driverName: printer.DriverName,
            portName: printer.PortName,
          }));
          setSatoPrinters(formattedList);
        } 
        // 인쇄 결과 응답 처리
        else if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
          setStatus({ message: 'SATO 프린터로 성공적으로 인쇄했습니다!', color: 'green' });
        } else if (response.Error) {
          setStatus({ message: `SATO 오류: ${response.Error}`, color: 'red' });
        }
      } catch (e) {
        if (event.data.toLowerCase() === "true") {
          setStatus({ message: 'SATO 프린터로 성공적으로 인쇄했습니다!', color: 'green' });
        } else {
          console.log("Received non-JSON message from SATO:", event.data);
        }
      }
    };

    socket.onclose = (event) => {
      if (!event.wasClean) {
        setStatus({ message: 'SATO 프린터 연결이 끊어졌습니다. SATO All-In-One Tool을 확인하세요.', color: 'red' });
      }
      console.log("SATO WebSocket Connection closed.");
      socketRef.current = null;
    };

    socket.onerror = (error) => {
      setStatus({ message: 'SATO 연결 오류. SATO All-In-One Tool 실행을 확인해주세요.', color: 'red' });
      console.error("SATO WebSocket Error:", error);
      socketRef.current = null;
    };
  };

  // ZEBRA 프린터 목록을 가져오는 비동기 함수
  const getZebraPrinterList = () => {
    return new Promise((resolve) => {
      if (!window.BrowserPrint) {
        console.warn("BrowserPrint SDK가 로드되지 않았습니다.");
        return resolve([]);
      }
      window.BrowserPrint.getLocalDevices(
        (deviceList) => {
          zebraDeviceList.current = deviceList;
          const formattedList = deviceList.map(device => ({
            value: `ZEBRA_${device.uid}`,
            label: `ZEBRA: ${device.name}`,
            uid: device.uid
          }));
          setZebraPrinters(formattedList);
          resolve();
        },
        () => {
          console.error("로컬 프린터를 가져오는 데 실패했습니다.");
          resolve();
        },
        "printer"
      );
    });
  };

  // 테스트 인쇄 버튼 클릭 핸들러
  const handlePrintTest = () => {
    if (!selectedPrinter) {
      alert("프린터를 선택해주세요.");
      return;
    }
    
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
      sbplCommand += ESC + 'Q1';
      sbplCommand += ESC + 'Z';
      const base64Data = btoa(sbplCommand);
      const printJob = {
        "Method": "Driver.SendRawData",
        "Parameters": {
          "DriverName": printerInfo.driverName,
          "Data": base64Data
        }
      };

      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        setStatus({ message: 'SATO 프린터에 다시 연결하는 중...', color: 'orange' });
        pendingSatoPrintJob.current = printJob; // 인쇄 작업을 대기열에 추가
        setupSatoSocket(); // 재연결 시도
        return;
      }
      
      setStatus({ message: 'SATO 프린터에 인쇄 명령을 전송합니다...', color: 'orange' });
      socketRef.current.send(JSON.stringify(printJob));

    } else if (selectedPrinter.startsWith('ZEBRA_')) {
      const selectedDevice = zebraDeviceList.current.find(device => device.uid === printerInfo.uid);
      if (selectedDevice) {
        setStatus({ message: 'ZEBRA 프린터로 인쇄 명령을 전송했습니다...', color: 'orange' });
        let zplCommand = '';
        zplCommand += '^XA'; // 인쇄 시작
        zplCommand += '^FO50,50^A0N,28,28^FDZEBRA Print Test^FS'; // 텍스트
        zplCommand += '^FO50,100^BY2^BCN,100,Y,N,N^FD1234567890^FS'; // 바코드
        zplCommand += '^XZ'; // 인쇄 종료
        selectedDevice.send(zplCommand,
          () => setStatus({ message: 'ZEBRA 프린터에서 성공적으로 인쇄했습니다!', color: 'green' }),
          (error) => setStatus({ message: `ZEBRA 인쇄 오류: ${error}`, color: 'red' })
        );
      } else {
        setStatus({ message: '선택된 ZEBRA 장치를 찾을 수 없습니다.', color: 'red' });
      }
    }
  };

  // 컴포넌트 마운트 시 프린터 목록 조회 시작
  useEffect(() => {
    setupSatoSocket();
    getZebraPrinterList();

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  // SATO 또는 ZEBRA 프린터 목록이 변경될 때마다 전체 목록 업데이트
  useEffect(() => {
    const combinedPrinters = [...satoPrinters, ...zebraPrinters];
    setPrinters(combinedPrinters);

    if (combinedPrinters.length > 0) {
      const isSelectedPrinterValid = combinedPrinters.some(p => p.value === selectedPrinter);
      if (!selectedPrinter || !isSelectedPrinterValid) {
        setSelectedPrinter(combinedPrinters[0].value);
      }
      setStatus({ message: '프린터 목록을 성공적으로 가져왔습니다.', color: 'green' });
    } else {
      if(satoPrinters.length === 0 && zebraPrinters.length === 0) {
        setStatus({ message: '사용 가능한 프린터를 찾을 수 없습니다.', color: 'red' });
      }
    }
  }, [satoPrinters, zebraPrinters]);

  return (
    <div className="App">
      <header className="App-header">
        <h2>프린터 선택</h2>
        <div style={{ color: status.color, margin: '10px 0', minHeight: '24px', transition: 'color 0.3s' }}>
          {status.message}
        </div>
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
        <button 
          onClick={handlePrintTest} 
          disabled={!selectedPrinter}
          style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: '#61dafb', color: '#282c34', fontSize: '16px' }}
        >
          테스트 프린터 인쇄
        </button>
      </header>
    </div>
  );
}

export default App;
