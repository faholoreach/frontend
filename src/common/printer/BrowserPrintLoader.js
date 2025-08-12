class BrowserPrintLoader {
    constructor() {
        this.isLoaded = false;
        this.loadingPromise = null;
        this.browserPrint = null;
    }

    // Remote App의 BrowserPrint.js 동적 로딩
    async loadBrowserPrint() {
        // 이미 로드되었다면 기존 인스턴스를 반환
        if(this.isLoaded && this.browserPrint) {
            return this.browserPrint;
        }

        // 로딩 중이면 기존 Promise 반환 (중복 로딩 방지)
        if(this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = new Promise((resolve, reject) => {
            // Remote App의 public 폴더 경로
            let remoteBaseUrl = this.getRemoteBaseUrl();
            
            if(remoteBaseUrl === undefined) {
                remoteBaseUrl = '';
            }
            const scriptUrl = `${remoteBaseUrl}/extfiles/printer/js/BrowserPrint-3.1.250.min.js`;
            
            console.log('Loading BrowserPrint from Remote App', scriptUrl);

            //이미 로드된 스크립트 확인.
            const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
            if (existingScript && window.BrowserPrint) {
                this.browserPrint = window.BrowserPrint;
                this.isLoaded = true;
                console.log('BrowserPrint already loaded');
                return;
            }

            //새로운 script 태그 생성
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.crossOrigin = 'anonymous';

            script.onload = () => {
                if (window.BrowserPrint) {
                    this.browserPrint = window.BrowserPrint;
                    this.isLoaded = true;
                    console.log('BrowserPrint loaded Successfully from Remote App');
                    console.log('Available method:', Object.getOwnPropertyNames(window.BrowserPrint));
                    resolve(this.browserPrint);
                } else {
                    const error = new Error('BrowserPrint object not found on window');
                    console.error('XXXX', error.message);
                    reject(error);
                }
            };

            script.onerror = () => {
                const error = new Error(`Failed to load BrowserPrint from: ${scriptUrl}`);
                console.error('XXX', error.message);
                reject(error);
            };

            document.head.appendChild(script);
        });

        return this.loadingPromise;
    }
    // Remote App의 base URL 결정
    getRemoteBaseUrl() {
        return process.env.REMOTE_APP_URL;
    }

    //라이브러리 로드 상태 확인
    getLoadStatus() {
        return {
            isLoaded: this.isLoaded,
            isLoading: !!this.loadingPromise && !this.isLoaded,
            browserPrint: this.browserPrint,
            version: this.browserPrint ? this.getVersion() : null,
            availableMethod: this.browserPrint ? this.getAvailableMethods() : []
        };
    }

    // BrowserPrint 버전 정보
    getVersion() {
        try{
            return this.browserPrint.version || 'Unknown';
        } catch(error) {
            return 'Unable to determine';
        }
    }

    // 사용 가능한 메서드 목록
    getAvailableMethods() {
        if(!this.browserPrint) return [];

        try{
            return Object.getOwnPropertyNames(this.browserPrint)
                .filter(prop => typeof this.browserPrint[prop] === 'function');
        } catch (error) {
            return [];
        }
    }

    //연결 테스트 (프린터 없이도 실행 가능)
    async testConnection() {
        if (!this.browserPrint) {
            throw new Error('BrowserPrint not loaded');
        }

        return new Promise((resolve) => {
            try {
                // getLocalDevices는 프린터가 없어도 빈 배역을 반환
                this.browserPrint.getLocalDevices(
                    (devices) => {
                        resolve({
                            success: true,
                            message: 'Connection test successful',
                            deviceCount: devices ? devices.length: 0,
                            devices: devices || []
                        });
                    },
                    (error) => {
                        resolve({
                            success: false,
                            message: `Connection test failed: ${error}`,
                            deviceCount: 0,
                            devices: []
                        });
                    }
                );
            } catch (error) {
                resolve({
                    success: false,
                    message: `Test error: ${error.message}`,
                    deviceCount: 0,
                    devices: []
                });
            }
        });
    }

    // 정리
    cleanup() {
        this.browserPrint = null;
        this.isLoaded = false;
        this.loadingPromise = null;
    }
}

export const browserPrintLoader = new BrowserPrintLoader();