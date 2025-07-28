import React, { useState, useRef } from 'react';

// ZEBRA 프린터 제어용 컴포넌트
const ZebraPrinter = () => {
    const [status, setStatus] = useState({ message: '대기 중...', color: 'black' });
    const [selectedDevice, setSelectedDevice] = useState(null);
    const socketRef = useRef(null);

    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState('');

    // Zebra Browser Print가 사용하는 기본 웹소켓 주소
    const ZEBRA_WEBSOCKET_URL = "ws://localhost:9100/";

    // ZEBRA 프로그램과 통신하는 방식은 SATO와 다를 수 있으므로,
    // 연결 및 에러 핸들링을 위한 별도의 함수를 만듭니다.

    const getZEBRAPrinterList = async () => {
        if (!window.BrowserPrint) {
            alert("BrowserPrint가 로드되지 않았습니다.");
        return;
    }

    // 프린터 목록 가져오기
    window.BrowserPrint.getLocalDevices(
        (deviceList) => {
            setPrinters(deviceList);
        },
        () => {
            alert("로컬 프린터를 가져오는 데 실패했습니다.");
        },
        "printer"
        );
    }

    const handleSelect = (e) => {
        const selectedUid = e.target.value;
        const printer = printers.find((p) => p.uid === selectedUid);
        setSelectedPrinter(printer);
    };

      const handleTestPrint = () => {
    if (!selectedPrinter) {
      alert("프린터를 선택하세요.");
      return;
    }

    const testBarcodeData = "1234567890";

    const zpl = `
^XA
^CF0,40
^FO50,50^FD바코드 테스트 출력^FS

^FO50,100
^BY2,2,60
^BCN,100,Y,N,N
^FD${testBarcodeData}^FS

^FO50,220^FD값: ${testBarcodeData}^FS
^XZ
    `.trim();

    selectedPrinter.send(zpl,
      () => alert("✅ 바코드 출력 명령 전송 완료"),
      (error) => alert("❌ 출력 오류: " + error)
    );
  };

    

    const setupZebraSocket = (onOpenCallback) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            onOpenCallback(socketRef.current);
            return;
        }

        setStatus({ message: 'Zebra 서버에 연결 중...', color: 'orange' });
        const newSocket = new WebSocket(ZEBRA_WEBSOCKET_URL);

        newSocket.onopen = () => {
            setStatus({ message: 'Zebra 서버에 연결되었습니다.', color: 'green' });
            if (onOpenCallback) onOpenCallback(newSocket);
        };

        newSocket.onmessage = (event) => {
            console.log(`[Zebra Server] ${event.data}`);
            // Zebra Browser Print는 보통 기본 프린터 정보를 바로 반환합니다.
            const device = JSON.parse(event.data);
            if (device && device.printer) {
                setSelectedDevice(device.printer);
                setStatus({ message: '기본 프린터를 찾았습니다.', color: 'green' });
            }
        };

        newSocket.onclose = () => socketRef.current = null;
        newSocket.onerror = () => {
            setStatus({ message: 'Zebra 연결 오류. 프로그램을 확인하세요.', color: 'red' });
            socketRef.current = null;
        };

        socketRef.current = newSocket;
    };

    /**
     * ZPL 인쇄 명령을 생성하고 전송하는 함수
     */
    const sendPrintCommand = () => {
        if (!selectedDevice) {
            setStatus({ message: '먼저 프린터를 찾아주세요.', color: 'red' });
            return;
        }

        // ZPL (Zebra Programming Language) 명령어 생성
        let zplCommand = '';
        zplCommand += '^XA'; // 인쇄 시작
        zplCommand += '^FO50,50^A0N,28,28^FDZEBRA Print Test^FS'; // 텍스트
        zplCommand += '^FO50,100^BY2^BCN,100,Y,N,N^FD1234567890^FS'; // 바코드
        zplCommand += '^XZ'; // 인쇄 종료

        // Zebra Browser Print에 맞는 요청 데이터 형식
        const printJob = {
            device: selectedDevice,
            data: zplCommand
        };

        socketRef.current.send(JSON.stringify(printJob));
        console.log("Sending ZPL Job:", printJob);
        setStatus({ message: 'Zebra 프린터로 인쇄 명령 전송.', color: 'blue' });
    };

    /**
     * 기본 프린터 정보를 가져오는 함수
     */
    const findDefaultPrinter = (socket) => {
        // Zebra Browser Print는 연결 시 기본 프린터 정보를 보내주거나,
        // 특정 요청을 보내야 할 수 있습니다. 여기서는 연결 시 자동으로 받는다고 가정합니다.
        setStatus({ message: 'Zebra 기본 프린터를 찾는 중...', color: 'orange' });
    };

    const handleFindPrinterClick = () => getZEBRAPrinterList(findDefaultPrinter);
    const handlePrintClick = () => handleTestPrint(sendPrintCommand);

    return (
        <div style={{ fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
            <h2>ZEBRA 프린터 제어</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={handleFindPrinterClick}
                    style={{ fontSize: '16px', padding: '12px 24px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
                >
                    기본 프린터 찾기 🔍
                </button>
                <button
                    onClick={handlePrintClick}
                    style={{ fontSize: '16px', padding: '12px 24px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
                >
                    테스트 인쇄 🖨️
                </button>
            </div>
            <div style={{ marginBottom: '20px' }}><strong style={{ color: status.color }}>상태: {status.message}</strong></div>
            <h3>프린터 선택:</h3>
            <select onChange={handleSelect} defaultValue="">
                <option value="" disabled>-- 프린터를 선택하세요 --</option>
                {printers.map((printer) => (
                <option key={printer.uid} value={printer.uid}>
                    {printer.name}
                </option>
                ))}
            </select>
        </div>
    );
};

export default ZebraPrinter;