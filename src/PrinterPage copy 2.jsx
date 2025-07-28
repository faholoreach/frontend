import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// SATO 프린터 웹소켓 URL
const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

function App() {
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [status, setStatus] = useState({ message: '프린터를 찾는 중...', color: 'orange' });
  const socketRef = useRef(null);
  const zebraDeviceList = useRef([]); // ZEBRA 장치 전체 목록을 저장하기 위한 Ref

  /**
   * SATO 프린터 목록을 가져오는 비동기 함수
   */
  const getSatoPrinterList = () => {
    return new Promise((resolve) => {
      const connectWebSocket = (onOpenCallback) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          onOpenCallback(socketRef.current);
          return;
        }

        setStatus({ message: 'SATO 프린터 서버에 연결을 시도합니다...', color: 'orange' });
        const newSocket = new WebSocket(SATO_WEBSOCKET_URL);

        newSocket.onopen = () => {
          setStatus({ message: 'SATO 프린터에 성공적으로 연결되었습니다.', color: 'green' });
          console.log("SATO WebSocket Connection established.");
          if (onOpenCallback) {
            onOpenCallback(newSocket);
          }
        };

        newSocket.onmessage = (event) => {
          console.log(`[SATO Message from Server] ${event.data}`);
          try {
            const response = JSON.parse(event.data);
            console.log("Parsed SATO server response:", response);

            if (Array.isArray(response)) {
              const formattedList = response.map(printer => ({
                value: `SATO_${printer.PortName}`,
                label: `SATO: ${printer.DriverName}`,
              }));
              setStatus({ message: 'SATO 프린터 목록을 성공적으로 가져왔습니다.', color: 'green' });
              resolve(formattedList); // Promise를 프린터 목록으로 resolve
            }
            // 다른 메시지 처리 로직은 여기서는 생략합니다.
          } catch (e) {
            console.log("Received non-JSON message from SATO:", event.data);
          }
        };

        newSocket.onclose = (event) => {
          if (!event.wasClean) {
            setStatus({ message: 'SATO 프린터 연결이 끊어졌습니다. SATO All-In-One Tool을 확인하세요.', color: 'red' });
          }
          console.log("SATO WebSocket Connection closed.");
          socketRef.current = null;
          resolve([]); // 연결 실패 시 빈 배열로 resolve
        };

        newSocket.onerror = (error) => {
          setStatus({ message: 'SATO 연결 오류. SATO All-In-One Tool 실행을 확인해주세요.', color: 'red' });
          console.error("SATO WebSocket Error:", error);
          socketRef.current = null;
          resolve([]); // 오류 발생 시 빈 배열로 resolve
        };

        socketRef.current = newSocket;
      };

      const requestPrinterList = (socket) => {
        const getListJob = { "Method": "Driver.GetDriverList" };
        socket.send(JSON.stringify(getListJob));
        console.log("Requesting SATO Printer List:", getListJob);
        setStatus({ message: 'SATO 프린터 목록을 요청하는 중...', color: 'orange' });
      };

      // 웹소켓에 연결하고 연결이 성공하면 프린터 목록을 요청합니다.
      connectWebSocket(requestPrinterList);
    });
  };

  /**
   * ZEBRA 프린터 목록을 가져오는 비동기 함수
   */
  const getZebraPrinterList = () => {
    return new Promise((resolve) => {
      if (!window.BrowserPrint) {
        console.warn("BrowserPrint SDK가 로드되지 않았습니다.");
        return resolve([]);
      }
      window.BrowserPrint.getLocalDevices(
        (deviceList) => {
          zebraDeviceList.current = deviceList; // 나중에 send() 메소드를 사용하기 위해 전체 목록 저장
          const formattedList = deviceList.map(device => ({
            value: `ZEBRA_${device.uid}`,
            label: `ZEBRA: ${device.name}`,
            uid: device.uid
          }));
          resolve(formattedList);
        },
        () => {
          console.error("로컬 프린터를 가져오는 데 실패했습니다.");
          resolve([]);
        },
        "printer"
      );
    });
  };

  /**
   * 테스트 인쇄 버튼 클릭 이벤트 핸들러
   */
  const handlePrintTest = () => {
    if (!selectedPrinter) {
      alert("먼저 프린터를 선택해주세요.");
      return;
    }

    const printerInfo = printers.find(p => p.value === selectedPrinter);
    if (!printerInfo) {
      alert("선택된 프린터 정보를 찾을 수 없습니다.");
      return;
    }

    // 프린터 종류에 따라 다른 인쇄 함수 호출
    if (printerInfo.value.startsWith('SATO_')) {
      const printJob = {
        "Method": "Raw.Print",
        "DriverName": printerInfo.DriverName,
        "PortName": printerInfo.PortName,
        "Data": "^XA^FO50,50^A0N,50,50^FDTest Print SATO^FS^XZ" // 테스트 ZPL 데이터
      };
      connectAndPrintSato(printJob);
    } else if (printerInfo.value.startsWith('ZEBRA_')) {
      const selectedDevice = zebraDeviceList.current.find(d => d.uid === printerInfo.uid);
      if (selectedDevice) {
        setStatus({ message: 'ZEBRA 프린터로 인쇄 명령을 전송합니다...', color: 'orange' });
        const zplData = "^XA^FO50,50^A0N,50,50^FDTest Print ZEBRA^FS^XZ";
        selectedDevice.send(zplData,
          () => setStatus({ message: 'ZEBRA 프린터에서 성공적으로 인쇄했습니다!', color: 'green' }),
          (error) => setStatus({ message: `ZEBRA 인쇄 오류: ${error}`, color: 'red' })
        );
      } else {
        setStatus({ message: '선택된 ZEBRA 장치를 찾을 수 없습니다.', color: 'red' });
      }
    }
  };

  /**
   * SATO 프린터 인쇄를 위한 웹소켓 연결 및 전송 함수
   */
  const connectAndPrintSato = (printJob) => {
    const printSocket = new WebSocket(SATO_WEBSOCKET_URL);
    setStatus({ message: 'SATO 프린터에 인쇄 명령을 전송합니다...', color: 'orange' });

    printSocket.onopen = () => {
      printSocket.send(JSON.stringify(printJob));
    };

    printSocket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
          setStatus({ message: 'SATO 프린터로 성공적으로 인쇄했습니다!', color: 'green' });
        } else if (response.Error) {
          setStatus({ message: `SATO 오류: ${response.Error}`, color: 'red' });
        }
      } catch (e) {
        // 성공 시 'true' 문자열만 오는 경우 처리
        if (event.data.toLowerCase() === "true") {
           setStatus({ message: 'SATO 프린터로 성공적으로 인쇄했습니다!', color: 'green' });
        }
      }
      printSocket.close();
    };

    printSocket.onerror = () => {
      setStatus({ message: 'SATO 프린터 연결에 실패했습니다.', color: 'red' });
    };
  };

  useEffect(() => {
    const fetchPrinters = async () => {
      setStatus({ message: '모든 프린터 목록을 가져오는 중...', color: 'orange' });
      const results = await Promise.allSettled([getSatoPrinterList(), getZebraPrinterList()]);

      const satoPrinters = results[0].status === 'fulfilled' ? results[0].value : [];
      const zebraPrinters = results[1].status === 'fulfilled' ? results[1].value : [];
      const combinedPrinters = [...satoPrinters, ...zebraPrinters];
      setPrinters(combinedPrinters);

      if (combinedPrinters.length > 0) {
        setSelectedPrinter(combinedPrinters[0].value);
        setStatus({ message: '프린터 목록을 성공적으로 가져왔습니다.', color: 'green' });
      } else {
        setStatus({ message: '사용 가능한 프린터를 찾을 수 없습니다. SATO All-in-One Tool 또는 Zebra Browser Print가 실행 중인지 확인하세요.', color: 'red' });
      }
    };

    fetchPrinters();

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h2>프린터 선택</h2>
        <div style={{ color: status.color, margin: '10px 0', minHeight: '24px' }}>
          {status.message}
        </div>
        <select
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          disabled={printers.length === 0}
          style={{ marginBottom: '20px', padding: '8px', minWidth: '300px' }}
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
        <button onClick={handlePrintTest} disabled={!selectedPrinter} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          테스트 프린터 인쇄
        </button>
      </header>
    </div>
  );
}

export default App;