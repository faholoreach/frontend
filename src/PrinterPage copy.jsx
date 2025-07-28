import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
// import BrowserPrint from '../public/BrowserPrint-3.1.250.min.js';

export default function PrinterPage() {
  const [barcodes, setBarcodes] = useState([
    { barcode: 'ABC123', x: 100, y: 100 },
    { barcode: 'DEF456', x: 100, y: 300 },
  ]);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceUid, setSelectedDeviceUid] = useState('');

  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printerList, setPrinterList] = useState([]);
  
  const [logMessages, setLogMessages] = useState([]);

  const ws = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

    useEffect(() => {
    // 웹소켓 서버 주소
    const WEBSOCKET_URL = "ws://localhost:8055/SATOPrinterAPI";

    // 웹소켓 객체 생성 및 연결
    ws.current = new WebSocket(WEBSOCKET_URL);

    // 연결 성공 시
    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setError(null); // 연결 성공 시 에러 메시지 초기화
    };

    // 서버로부터 메시지 수신 시
    ws.current.onmessage = (event) => {
      console.log("Message from server: ", event.data);
      try {
        // 서버로부터 받은 JSON 문자열을 Javascript 배열로 파싱
        // const printerList = JSON.parse(event.data);
        
        // // 응답이 배열 형태인지 확인 후 상태 업데이트
        // if (Array.isArray(printerList)) {
        //   setPrinters(printerList);
        // } else {
        //     // 예상치 못한 형식의 데이터가 올 경우를 대비
        //     console.warn("Received data is not an array:", printerList);
        // }

      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        setError("서버 응답을 처리하는 중 오류가 발생했습니다.");
      }
    };

    // 연결 에러 발생 시
    ws.current.onerror = (err) => {
      console.error("WebSocket error: ", err);
      setError("웹소켓 연결에 실패했습니다. SATO 프로그램이 실행 중인지 확인해주세요.");
      setIsConnected(false);
    };

    // 연결 종료 시
    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    // 컴포넌트가 사라질 때(unmount) 웹소켓 연결을 정리
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []); // 빈 배열을 전달하여 컴포넌트가 처음 마운트될 때 한 번만 실행되도록 설정

  // "프린터 목록 가져오기" 버튼 클릭 시 실행될 함수
  const handleFetchPrinters = () => {
    // 웹소켓이 연결 상태인지 확인
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // 서버에 보낼 요청 메시지
      const requestMessage = {
        Method: "Printer.GetUSBList",
      };
      
      // Javascript 객체를 JSON 문자열로 변환하여 서버에 전송
      ws.current.send(JSON.stringify(requestMessage));
      
      // 목록을 요청했으니 기존 목록은 비워주는 것이 사용자 경험에 좋음
      setPrinters([]); 
    } else {
      setError("웹소켓이 연결되어 있지 않습니다. 페이지를 새로고침하거나 프로그램을 확인해주세요.");
    }
  };


  // ✅ 프린터 목록 불러오기
  // useEffect(() => {
  //   axios.get('/api/printer/list')
  //     .then(res => {
  //       setPrinterList(res.data);
  //       if (res.data.length > 0) setSelectedPrinter(res.data[0]);
  //     })
  //     .catch(err => {
  //       console.error('프린터 목록 불러오기 실패', err);
  //     });
  // }, []);

  const getSATOPrinterList = async () => {
    // axios.get('/api/printer/list')
    //   .then(res => {
    //     setPrinterList(res.data);
    //     if (res.data.length > 0) setSelectedPrinter(res.data[0]);
    //   })
    //   .catch(err => {
    //     console.error('프린터 목록 불러오기 실패', err);
    //   });

    const socket = new WebSocket("ws://localhost:8055/SATOPrinterAPI");

    socket.onopen = () => {
      console.log("✅ WebSocket 연결됨");
      const newMessage = "✅ WebSocket 연결됨";

      const message = {
        command: 'GetUSBList'
      }
      socket.send(JSON.stringify(message));

      // setLogMessages(prev => [...prev, newMessage]);


      // const sbplCommand =
      //   // "\u001BA" + 
      //   // "\u001BH250" + 
      //   // "\u001BV063" + 
      //   // "\u001BL0101" + 
      //   // "\u001BBG0208012345" + 
      //   // "\u001BH475" + 
      //   // "\u001BV148" + 
      //   // "\u001BL0101" + 
      //   // "\u001BSTEXT" + 
      //   // "\u001BQ1" + 
      //   // "\u001BZ" + 
      //   // "\u001BA" + 
      //   // "\u001B*X" + 
      //   // "\u001BZ";

      //   "[ESC]A"+
      //   "[ESC]V10[ESC]H5[ESC]L0404[ESC]XB1SATO"+
      //   "[ESC]V35[ESC]H10[ESC]B104250*12345*"+
      //   "[ESC]Q1"+
      //   "[ESC]Z";


      // socket.send(sbplCommand);
    };

    socket.onmessage = (event) => {
      console.log("📦 받은 메시지:", event.data);

      try {
        const response = JSON.parse(event.data);

        setLogMessages(prev => [...prev, response]);

        if (Array.isArray(response.Printers)) {
          console.log("🖨️ 프린터 목록:", response.Printers);
          // UI에 출력할 수 있음
        } else {
          console.warn("⚠️ 프린터 목록 형식 아님:", response);
        }
      } catch (err) {
        console.error("응답 처리 실패:", err);
      }
    };
  
  }

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

  // const handlePrint = async () => {
  //   try {
  //     console.log("selectedPrinter: " + selectedPrinter);
  //     console.log("items: " + barcodes);

  //     console.log(JSON.stringify({
  //       printerName: selectedPrinter,
  //       items: barcodes
  //     }, null, 2));

  //     await axios.post('/api/printer/print-barcodes', {
  //       printerName: selectedPrinter,
  //       items: barcodes,
  //     }, {
  //       headers: { 'Content-Type': 'application/json' }
  //     });
  //     alert('출력 성공');
  //   } catch (err) {
  //     console.error('출력 실패', err.response?.data || err.message);
  //     alert('출력 실패');
  //   }
  // };

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


  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">바코드 출력 테스트</h2>

      <button onClick={getZEBRAPrinterList} className="bg-blue-600 text-white px-4 py-2 rounded">
        ZEBRA 불러오기
      </button>
      <br/>
      <label>프린터 선택:</label>
      <select onChange={handleSelect} defaultValue="">
        <option value="" disabled>-- 프린터를 선택하세요 --</option>
        {printers.map((printer) => (
          <option key={printer.uid} value={printer.uid}>
            {printer.name}
          </option>
        ))}
      </select>
      <br /><br />
      <button onClick={handleTestPrint}>🖨️ 테스트 출력</button>
      <br/>
      <button onClick={getSATOPrinterList} className="bg-blue-600 text-white px-4 py-2 rounded">
        SATO 불러오기
      </button>
      <br/>

      <label className="block">
        프린터 선택:
        {/* <select
          className="border px-2 py-1 ml-2"
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
        >
          {printerList.map((printer) => (
            <option key={printer} value={printer}>
              {printer}
            </option>
          ))}
        </select> */}
      </label>

      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}>
      <h1>SATO 프린터 목록 조회</h1>
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <strong>연결 상태: </strong>
        {isConnected ? (
          <span style={{ color: 'green', fontWeight: 'bold' }}>● 연결됨</span>
        ) : (
          <span style={{ color: 'red', fontWeight: 'bold' }}>🔴 연결 끊김</span>
        )}
        {error && <p style={{ color: 'red' }}><strong>에러:</strong> {error}</p>}
      </div>
      
      <button 
        onClick={handleFetchPrinters}
        disabled={!isConnected}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: isConnected ? 'pointer' : 'not-allowed' }}
      >
        프린터 목록 가져오기
      </button>

      <h2 style={{ marginTop: '30px' }}>프린터 목록</h2>
      {printers.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {/* 응답받는 정보인 name과 portID로 화면 표시 로직 변경 */}
          {printers.map((printer, index) => (
            <li key={printer.portID || index} style={{ border: '1px solid #eee', padding: '15px', marginBottom: '10px', borderRadius: '5px' }}>
              <strong>프린터 이름 (name):</strong> {printer.name}<br />
              <strong>포트 ID (portID):</strong> {printer.portID}<br />
            </li>
          ))}
        </ul>
      ) : (
        <p>표시할 프린터가 없습니다. 버튼을 눌러 목록을 조회하세요.</p>
      )}
    </div>

      <ul id="printer-list"></ul>

      <pre className="bg-gray-100 p-2">{JSON.stringify(barcodes, null, 2)}</pre>

      {/* <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded">
        출력
      </button> */}

      <br/>
      <h3>로그 메시지:</h3>
        <div>
          {logMessages.map((msg, index) => (
            <div key={index}>• {msg}</div>
          ))}
        </div>
    </div>
  );
}