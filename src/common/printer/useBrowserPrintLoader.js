import { useState, useEffect, useCallback } from "react";
import { browserPrintLoader } from "./BrowserPrintLoader";

export const useBrowserPrintLoader = () => {
    const[loading, setLoading] =useState(false);
    const[loaded, setLoaded] =useState(false);
    const[error, setError] =useState(null);
    const[loadStatus, setLoadStatus] =useState(null);
    const[testResult, setTestResult] =useState(null);

    // BrowserPrint 로드
    const loadLibrary = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Starting BrowserPrint load...');
            await browserPrintLoader.loadBrowserPrint();

            const status = browserPrintLoader.getLoadStatus();
            setLoadStatus(status);
            setLoaded(true);

            console.log('BrowserPrint loaded: ', status);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load BrowserPrint: ', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const testConnection = useCallback(async () => {
        if(!loaded) {
            setError('Library not loaded yet');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('Testing BrowserPrint connection...');
            const result = await browserPrintLoader.testConnection();
            setTestResult(result);
            console.log('Test result: ', result);
        } catch (err) {
            setError(err.message);
            console.error('Test failed: ', err);
        } finally {
            setLoading(false);
        }
    }, [loaded]);

    //상태 새로고침
    const refreshStatus = useCallback(() => {
        if(browserPrintLoader.isLoaded) {
            const status = browserPrintLoader.getLoadStatus();
            setLoadStatus(status);
            setLoaded(true);
        }
    }, []);

    //컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            // 필요시 정리 작업
        }
    }, []);

    return {
        loading,
        loaded,
        error,
        loadStatus,
        testResult,

        // 액션
        loadLibrary,
        testConnection,
        refreshStatus
    };
};