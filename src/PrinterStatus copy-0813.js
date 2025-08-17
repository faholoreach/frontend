import React, { useEffect } from 'react';
import { useBrowserPrintLoader } from './common/printer/useBrowserPrintLoader';

const PrinterStatus = () => {
    const {
        loading,
        loaded,
        error,
        loadStatus,
        testResult,
        loadLibrary,
        testConnection,
        refreshStatus
    } = useBrowserPrintLoader();

    useEffect(() => {
        loadLibrary();
    }, [loadLibrary]);

    const containerStyle = {
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif'
    };

    const cardStyle = {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        margin: '10px 0',
        backgroundColor: '#f9f9f9'
    };

    const buttonStyle = {
        padding: '10px, 20px',
        margin: '5px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
    };

    const primaryButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#007bff',
        color: 'white'
    };

    const successButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#28a745',
        color: 'white'
    };

    const warningButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#ffc107',
        color: 'black'
    };

    return (
        <div style={containerStyle}>
            <h2>Remote App - BrowserPrint 상태</h2>
        
            {loading && (
                <div style={{...cardStyle, backgroundColor: '#10151aff'}}>
                    <strong> 처리 중...</strong>
                    <p>BrowserPrint 라이브러리를 로딩하거나 테스트 중입니다.</p>
                </div>
            )}

            {error && (
                <div style={{...cardStyle, backgroundColor: '#110f0fff', borderColor: '#f44336'}}>
                    <strong>오류 발생</strong>
                    <p style={{coler: '#d32f2f'}}>{error}</p>
                    <button
                        style={warningButtonStyle}
                        onClick={loadLibrary}
                    >
                    다시 시도
                    </button>
                </div>
            )}

            <div style={cardStyle}>
                <h3>라이브러리 상태</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                    <div>
                        <strong>상태:</strong>{loaded ? '로드됨' : '미로드'}
                    </div>
                    <div>
                        <strong>로딩 중:</strong>{loading ? '예' : '아니요'}
                    </div>
                </div>

                {loadStatus && (
                    <div style={{marginTop: '15px'}}>
                        <strong>상세 정보:</strong>
                        <div style={{
                            backgroundColor: '#0a0808ff',
                            padding: '10px',
                            borderRadius: '4px',
                            marginTop: '5px',
                            fontSize: '12px',
                            fontFamily: 'monospace'
                        }}>
                            <div> * 버전: {loadStatus.version}</div>
                            
                        </div>
                    </div>
                )}
            </div>
        

            {testResult && (
                <div style={{
                    ...cardStyle,
                    backgroundColor: testResult.success ? '#0c0e0cff' : '#13110dff'
                }}>
                    <h3>연결 테스트 결과</h3>
                    <div>
                        <strong>결과: </strong>{testResult.success ? '성공' : '실패'}
                    </div>
                    <div>
                        <strong>메시지: </strong>{testResult.message}
                    </div>
                    <div>
                        <strong>발견된 디바이스: </strong>{testResult.deviceCount}개
                    </div>
                    {testResult.devices && testResult.devices.length > 0 && (
                        <div style={{marginTop: '10px'}}>
                            <strong>디바이스 목록: </strong>
                            <ul style={{marginTop: '5px'}}>
                                {testResult.devices.map((device, index) => (
                                    <li key={index}>
                                        {device.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div style={cardStyle}>
                <h3>제어</h3>
                <div>
                    <button
                        style={primaryButtonStyle}
                        onClick={loadLibrary}
                        disabled={loading}
                    >
                        {loaded ? '재로드' : '라이브러리 로드'}
                    </button>

                    <button
                        style={successButtonStyle}
                        onClick={testConnection}
                        disabled={loading || !loaded}
                    >
                        연결 테스트
                    </button>

                    <button
                        style={buttonStyle}
                        onClick={refreshStatus}
                        disabled={loading}
                    >
                        상태 새로고침
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrinterStatus;