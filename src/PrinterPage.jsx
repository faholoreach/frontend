import React, { useState, useRef } from 'react';

const PrinterPage = () => {
    const [status, setStatus] = useState({ message: '대기 중...', color: 'black' });
    const socketRef = useRef(null);
    
    const SATO_WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

    const sendPrintCommand = (socket) => {
        // 🚨 중요: Windows '프린터 및 스캐너'에 표시된 정확한 SATO 프린터 이름을 입력하세요.
        const printerName = "SATO CL4NX 203dpi"; // 이 이름은 Driver.SendRawData 메소드에서 사용됩니다.

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

        // ======================= 최종 핵심 수정 사항 (문서 기반) =======================
        // 1. SBPL 명령어를 Base64 문자열로 인코딩합니다. (문서 28페이지) [cite: 7814]
        const base64Data = btoa(sbplCommand);

        // 2. 문서에서 설명하는 정확한 JSON 구조로 요청 객체를 생성합니다.
        //    Driver 클래스의 SendRawData 메소드를 사용합니다. (문서 23, 28-30페이지) [cite: 7687-7698, 7812-7889]
        const printJob = {
            // "ClassName.MethodName" 형식으로 호출 [cite: 7821, 7835, 7849]
            "Method": "Driver.SendRawData", 
            // 메소드에 필요한 파라미터는 "Parameters" 객체 안에 정의 [cite: 7836, 7870]
            "Parameters": {
                "DriverName": printerName,
                "Data": base64Data      // Base64로 인코딩된 데이터를 전달 [cite: 7830, 7837]
            }
        };
        // ===========================================================================

        socket.send(JSON.stringify(printJob));

        console.log("Sending Final JSON Data based on PDF Manual:", printJob);
        setStatus({ message: `'${printerName}'으로 인쇄 명령을 전송했습니다.`, color: 'blue' });
    };

    const handlePrint = () => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            sendPrintCommand(socketRef.current);
            return;
        }

        setStatus({ message: '프린터 서버에 연결을 시도합니다...', color: 'orange' });
        
        const newSocket = new WebSocket(SATO_WEBSOCKET_URL);

        newSocket.onopen = () => {
            setStatus({ message: '프린터에 성공적으로 연결! 인쇄를 시작합니다.', color: 'green' });
            console.log("WebSocket Connection established.");
            sendPrintCommand(newSocket);
        };

        newSocket.onmessage = (event) => {
            console.log(`[Message from Server] ${event.data}`);
            try {
                const response = JSON.parse(event.data);
                console.log("Parsed server response:", response);
                if (response.Result === "Executed" || response.Status === "Success" || (typeof response === 'boolean' && response)) {
                     setStatus({ message: '프린터에서 성공적으로 인쇄했습니다!', color: 'green' });
                } else if (response.Error) {
                     setStatus({ message: `프린터 오류: ${response.Error}`, color: 'red' });
                }
            } catch (e) {
                // bool 값(true/false)과 같이 JSON이 아닌 응답이 올 수 있음
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
            setStatus({ message: '연결 오류 발생. SATO All-In-One Tool 실행 및 방화벽 설정을 확인해주세요.', color: 'red' });
            console.error("WebSocket Error:", error);
            socketRef.current = null;
        };
        
        socketRef.current = newSocket;
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
            <h1>프린터 제어 페이지 🖨️</h1>
            <p>
                아래 버튼을 눌러 USB로 연결된 SATO 프린터로 테스트 라벨을 인쇄합니다.<br/>
                <strong>주의:</strong> SATO All-In-One Tool이 반드시 실행 중이어야 합니다.
            </p>
            <button 
                onClick={handlePrint} 
                style={{ fontSize: '16px', padding: '12px 24px', cursor: 'pointer', marginBottom: '20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
            >
                연결 및 인쇄 (문서 기반 최종 방식)
            </button>
            <div style={{ padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
                <strong style={{ color: status.color }}>상태: {status.message}</strong>
            </div>
        </div>
    );
};

export default PrinterPage;