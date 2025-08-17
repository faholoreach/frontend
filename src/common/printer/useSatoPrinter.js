import { useState, useEffect, useRef, useCallback } from 'react';

const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

export const useSatoPrinter = () => {
  const [printers, setPrinters] = useState([]);
  const [status, setStatus] = useState({ message: '대기 중...', status: 'pending' });
  const socketRef = useRef(null);
  const pendingPrintJob = useRef(null);

  const setupSatoSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState < 2) {
      console.log('SATO WebSocket connection already exists or is connecting.');
      return;
    }

    setStatus({ message: 'SATO 서버에 연결하는 중...', status: 'pending' });
    const socket = new WebSocket(SATO_WEBSOCKET_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("SATO WebSocket Connection established.");
      setStatus({ message: '연결 성공. 목록 요청 중...', status: 'pending' });

      // 연결 후 보류 중인 작업이 있으면 전송
      if (pendingPrintJob.current) {
        socket.send(JSON.stringify(pendingPrintJob.current));
        pendingPrintJob.current = null;
      } else {
        // 보류 작업이 없으면 프린터 목록 요청
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
          setPrinters(formattedList);
          setStatus({ message: `프린터 ${formattedList.length}대 발견`, status: 'success' });
        } else if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
          setStatus({ message: '인쇄 성공!', status: 'success' });
        } else if (response.Error) {
          setStatus({ message: `오류: ${response.Error}`, status: 'error' });
        }
      } catch (e) {
        if (event.data.toLowerCase() === "true") {
          setStatus({ message: '인쇄 성공!', status: 'success' });
        } else {
          console.log("Received non-JSON message from SATO:", event.data);
        }
      }
    };

    socket.onclose = (event) => {
      if (!event.wasClean && status.status !== 'success') {
        setStatus({ message: 'SATO 연결이 끊어졌습니다.', status: 'error' });
      }
      console.log("SATO WebSocket Connection closed.");
      socketRef.current = null;
    };

    socket.onerror = (error) => {
      setStatus({ message: 'SATO 연결 오류.', status: 'error' });
      console.error("SATO WebSocket Error:", error);
      socketRef.current = null;
    };
  }, [status.status]);
  
  // App.js에서 호출할 인쇄 함수
  const sendSatoJob = useCallback((printJob) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setStatus({ message: '재연결 후 인쇄합니다...', status: 'pending' });
      pendingPrintJob.current = printJob;
      setupSatoSocket(); // 연결이 없으면 재설정 시도
      return;
    }
    setStatus({ message: '인쇄 명령 전송 중...', status: 'pending' });
    socketRef.current.send(JSON.stringify(printJob));
  }, [setupSatoSocket]);

  // 컴포넌트 마운트 시 최초 연결 설정
  useEffect(() => {
    setupSatoSocket();

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [setupSatoSocket]);

  return { satoPrinters: printers, satoStatus: status, sendSatoJob };
};