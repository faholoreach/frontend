import React, { useState, useRef } from 'react';

// 컴포넌트 이름을 SatoPrinter로 변경
const SatoPrinter = () => {
    // UI 메시지 상태
    const [status, setStatus] = useState({ message: '대기 중...', color: 'black' });
    // 프린터 목록을 저장할 새로운 상태
    const [printers, setPrinters] = useState([]);
    // 웹소켓 연결을 위한 Ref
    const socketRef = useRef(null);
    
    const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

    /**
     * 웹소켓 연결을 설정하고 관리하는 함수
     * @param {function} onOpenCallback - 연결 성공 시 실행할 콜백 함수
     */
    const connectWebSocket = (onOpenCallback) => {
        // 이미 연결되어 있으면 콜백 바로 실행
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            onOpenCallback(socketRef.current);
            return;
        }

        setStatus({ message: '프린터 서버에 연결을 시도합니다...', color: 'orange' });
        
        const newSocket = new WebSocket(SATO_WEBSOCKET_URL);

        newSocket.onopen = () => {
            setStatus({ message: '프린터에 성공적으로 연결되었습니다.', color: 'green' });
            console.log("WebSocket Connection established.");
            if (onOpenCallback) {
                onOpenCallback(newSocket); // 연결 후 콜백 함수 실행
            }
        };

        newSocket.onmessage = (event) => {
            console.log(`[Message from Server] ${event.data}`);
            try {
                const response = JSON.parse(event.data);
                console.log("Parsed server response:", response);

                // 응답이 배열 형태이면 프린터 목록으로 간주
                if (Array.isArray(response)) {
                    setPrinters(response);
                    setStatus({ message: '프린터 목록을 성공적으로 가져왔습니다.', color: 'green' });
                } else if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
                     setStatus({ message: '프린터에서 성공적으로 인쇄했습니다!', color: 'green' });
                } else if (response.Error) {
                     setStatus({ message: `오류: ${response.Error}`, color: 'red' });
                }
            } catch (e) {
                console.log("Received non-JSON message:", event.data);
                if (event.data.toLowerCase() === "true"){
                    setStatus({ message: '프린터에서 성공적으로 인쇄했습니다!', color: 'green' });
                }
            }
        };

        newSocket.onclose = (event) => {
            if (!event.wasClean) {
                setStatus({ message: '프린터 연결이 끊어졌습니다. SATO All-In-One Tool을 확인하세요.', color: 'red' });
            }
            console.log("WebSocket Connection closed.");
            socketRef.current = null;
        };

        newSocket.onerror = (error) => {
            setStatus({ message: '연결 오류 발생. SATO All-In-One Tool 실행을 확인해주세요.', color: 'red' });
            console.error("WebSocket Error:", error);
            socketRef.current = null;
        };
        
        socketRef.current = newSocket;
    };


    /**
     * SBPL 인쇄 명령을 생성하고 전송하는 함수
     * @param {WebSocket} socket - 통신할 웹소켓 인스턴스
     */
    const sendPrintCommand = (socket) => {
        const printerName = "SATO CL4NX 203dpi";

        const ESC = '\x1B';
        let sbplCommand = '';
        sbplCommand += ESC + 'A';
        sbplCommand += ESC + 'V0100';
        sbplCommand += ESC + 'H0400';
        sbplCommand += ESC + 'L0202';
        sbplCommand += ESC + '00PDF Manual Success!'; // 테스트 텍스트
        sbplCommand += ESC + 'V0100';
        sbplCommand += ESC + 'H0400';
        sbplCommand += ESC + 'B1031001234567890';
        sbplCommand += ESC + 'Q1';
        sbplCommand += ESC + 'Z';
    
        const base64Data = btoa(sbplCommand);

        const printJob = {
            "Method": "Driver.SendRawData",
            "Parameters": {
                "DriverName": printerName,
                "Data": base64Data
            }
        };

        socket.send(JSON.stringify(printJob));
        console.log("Sending Print Job:", printJob);
        setStatus({ message: `'${printerName}'으로 인쇄 명령을 전송했습니다.`, color: 'blue' });
    };

    /**
     * 프린터 목록을 요청하는 함수
     * @param {WebSocket} socket - 통신할 웹소켓 인스턴스
     */
    const getPrinterList = (socket) => {
        const getListJob = {
            "Method": "Driver.GetDriverList"
        };
        socket.send(JSON.stringify(getListJob));
        console.log("Requesting Printer List:", getListJob);
        setStatus({ message: '프린터 목록을 요청하는 중...', color: 'orange' });
    };

    // 인쇄 버튼 핸들러
    const handlePrintClick = () => {
        connectWebSocket(sendPrintCommand);
    };

    // 프린터 목록 가져오기 버튼 핸들러
    const handleGetPrintersClick = () => {
        connectWebSocket(getPrinterList);
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
            <h2>SATO 프린터 제어</h2>
            <p>
                <strong>주의:</strong> SATO All-In-One Tool이 반드시 실행 중이어야 합니다.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={handleGetPrintersClick}
                    style={{ fontSize: '16px', padding: '12px 24px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
                >
                    프린터 목록 가져오기 📋
                </button>
                <button 
                    onClick={handlePrintClick} 
                    style={{ fontSize: '16px', padding: '12px 24px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
                >
                    테스트 인쇄 🖨️
                </button>
            </div>
            <div style={{ padding: '10px', border: '1px solid #eee', borderRadius: '5px', marginBottom: '20px' }}>
                <strong style={{ color: status.color }}>상태: {status.message}</strong>
            </div>

            {/* 프린터 목록을 표시하는 부분 */}
            {printers.length > 0 && (
                <div>
                    <h3>연결된 프린터 드라이버 목록:</h3>
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {printers.map((printer, index) => (
                            <li key={index} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '5px', borderRadius: '5px' }}>
                                <strong>드라이버 이름:</strong> {printer.DriverName} <br/>
                                <strong>포트:</strong> {printer.PortName} <br/>
                                <strong>상태:</strong> {printer.Online ? '온라인' : '오프라인'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SatoPrinter;