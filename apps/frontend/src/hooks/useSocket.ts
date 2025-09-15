import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface DeviceInfo {
  socketId: string;
  userAgent: string;
  timestamp: number;
}

interface UserStatus {
  userId: string;
  userName: string;
  status: 'online' | 'offline';
  deviceCount: number;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  isReconnecting: boolean;
  setIsReconnecting: (reconnecting: boolean) => void;
  connect: () => void;
  disconnect: () => void;
  forceReconnect: () => Promise<void>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  canConnect: boolean;
  // 멀티 디바이스 관련 기능
  deviceCount: number;
  devices: DeviceInfo[];
  userStatuses: Map<string, UserStatus>;
  syncRead: (roomId: string, messageId: string) => void;
  syncTyping: (roomId: string, isTyping: boolean) => void;
  getDevices: () => void;
  getConnectionStats: () => void;
  // AI 서비스 오류
  aiServiceError: string | null;
  // 연결 디버그 정보
  connectionDebugInfo: string;
  setConnectionDebugInfo: (info: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const retryCountRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());
  const [aiServiceError, setAiServiceError] = useState<string | null>(null);
  const [connectionDebugInfo, setConnectionDebugInfo] = useState<string>('');

  const connect = useCallback(async () => {
    if (!session?.accessToken) {
      console.warn('No access token available');
      return;
    }

    console.log('Attempting socket connection with token:', {
      hasToken: !!session?.accessToken,
      tokenLength: session?.accessToken?.length,
      tokenStart: session?.accessToken?.substring(0, 20) + '...',
    });

    // 기존 소켓이 있다면 완전히 정리
    if (socketRef.current) {
      console.log('Cleaning up existing socket connection');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    try {
      // 모바일 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 모바일에서 백엔드 URL 자동 감지
      const getBackendUrl = async () => {
        if (isMobile && (window as any).workingBackendUrl) {
          console.log('Using cached working backend URL:', (window as any).workingBackendUrl);
          return (window as any).workingBackendUrl;
        }

        if (isMobile) {
          console.log('🔍 Mobile detected, testing backend URLs...');
          const possibleUrls = [
            'http://192.168.1.97:3001',
            'http://192.168.1.126:3001',
            'http://192.168.1.100:3001',
            'http://10.0.0.1:3001',
            'http://localhost:3001',
          ];

          for (const url of possibleUrls) {
            try {
              console.log(`Testing URL: ${url}`);
              const response = await fetch(`${url}/health`, {
                method: 'GET',
                timeout: 5000,
              } as any);

              if (response.ok) {
                console.log(`✅ Working backend URL found: ${url}`);
                (window as any).workingBackendUrl = url;
                return url;
              }
            } catch (error) {
              console.log(`❌ URL ${url} failed:`, error instanceof Error ? error.message : String(error));
            }
          }

          console.log('⚠️ No working backend URL found, using fallback');
          return possibleUrls[0]; // 첫 번째 URL을 fallback으로 사용
        }

        return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      };

      const backendUrl = await getBackendUrl();

      // 모바일에서는 폴링만 사용 (더 안정적)
      const socket = io(`${backendUrl}/chat`, {
        auth: {
          token: session?.accessToken,
        },
        transports: isMobile ? ['polling'] : ['websocket', 'polling'], // 모바일에서는 폴링만
        autoConnect: false, // 수동 연결로 변경
        timeout: isMobile ? 30000 : 10000, // 모바일에서 더 긴 타임아웃
        forceNew: true, // 새로운 연결 강제
        reconnection: false, // 자동 재연결 비활성화 (수동 제어)
        upgrade: !isMobile, // 모바일에서는 업그레이드 비활성화
        rememberUpgrade: false,
        // 모바일에서 추가 옵션
        ...(isMobile && {
          polling: {
            extraHeaders: {
              'X-Requested-With': 'XMLHttpRequest',
            },
          },
        }),
      });

      socket.on('connect', () => {
        console.log('🔌 Socket connected - waiting for authentication');
        console.log('📱 Mobile connection details:', {
          isMobile,
          userAgent: navigator.userAgent,
          transport: socket.io.engine.transport.name,
          timestamp: new Date().toISOString(),
        });
        // connect 이벤트는 단순히 소켓 연결만 의미, 인증은 별도
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        console.log('Disconnect details:', {
          reason,
          isMobile,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
        setIsConnected(false);
        retryCountRef.current = 0; // 연결이 끊어지면 재시도 카운터 리셋
      });

      socket.on('connected', (data) => {
        console.log('✅ Authenticated and connected:', data);
        console.log('🎉 Mobile socket connection successful!');
        setIsConnected(true); // 인증 성공 시에만 연결 상태로 설정
        retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋

        // 멀티 디바이스 정보 업데이트
        if (data.deviceCount) {
          setDeviceCount(data.deviceCount);
        }
      });

      socket.on('error', async (error) => {
        console.error('❌ Socket error:', error);
        console.error('🔍 Detailed error info:', {
          error,
          errorType: error.type,
          errorMessage: error.message,
          errorDescription: error.description,
          isMobile,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          retryCount: retryCountRef.current,
          socketId: socket.id,
          connected: socket.connected,
          transport: socket.io.engine?.transport?.name,
        });

        const errorMessage = error?.message || '알 수 없는 오류';

        // AI 서비스 관련 오류인지 확인
        if (errorMessage.includes('AI') || errorMessage.includes('응답') || errorMessage.includes('서비스')) {
          setConnectionDebugInfo(`AI 서비스 오류: ${errorMessage}`);
          setAiServiceError(errorMessage);
          // AI 서비스 오류는 연결 상태를 유지하되, 사용자에게 알림
          setIsConnected(true); // 소켓 연결은 유지
          setIsReconnecting(false);
        } else {
          setConnectionDebugInfo(`연결 오류: ${errorMessage}`);
          setAiServiceError(null); // 연결 오류는 AI 서비스 오류가 아님
          setIsConnected(false);
          setIsReconnecting(false);
        }

        // 토큰 만료 오류인 경우 토큰 갱신 시도
        if (error.message === '유효하지 않은 토큰입니다.' || error.message === 'Unauthorized') {
          console.log('🔄 토큰 만료 감지, 토큰 갱신 시도...');
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                refreshToken: session?.refreshToken,
              }),
            });

            if (refreshResponse.ok) {
              const newTokens = await refreshResponse.json();
              console.log('✅ 토큰 갱신 성공');

              // 새로운 토큰으로 소켓 재연결
              socket.auth = { token: newTokens.accessToken };
              socket.disconnect();
              setTimeout(() => {
                connect();
              }, 1000);
              return;
            } else {
              console.log('❌ 토큰 갱신 실패, 로그인 페이지로 이동');
              window.location.href = '/auth/signin';
              return;
            }
          } catch (refreshError) {
            console.error('❌ 토큰 갱신 중 오류:', refreshError);
            window.location.href = '/auth/signin';
            return;
          }
        }

        // 기타 인증 오류인 경우 재연결 시도 (최대 3회)
        if (
          (error.message === '인증되지 않은 사용자입니다.' ||
            error.message === '유효하지 않은 사용자입니다.' ||
            error.message === '인증 토큰이 필요합니다.') &&
          retryCountRef.current < 3
        ) {
          retryCountRef.current += 1;
          console.log(`Authentication failed, retrying connection... (${retryCountRef.current}/3)`);
          setTimeout(() => {
            if (session?.accessToken && socketRef.current) {
              socketRef.current.auth = { token: session?.accessToken };
              socketRef.current.connect();
            }
          }, 2000 * retryCountRef.current); // 재시도 간격을 점진적으로 증가
        } else if (retryCountRef.current >= 3) {
          console.error('Max retry attempts reached. Please refresh the page.');
        }
      });

      socket.on('message', (message) => {
        console.log('Received message:', message);
      });

      socket.on('stream', (data) => {
        console.log('Received stream:', data);
      });

      socket.on('userJoined', (data) => {
        console.log('User joined:', data);
      });

      socket.on('userLeft', (data) => {
        console.log('User left:', data);
      });

      socket.on('userTyping', (data) => {
        console.log('User typing:', data);
      });

      // 멀티 디바이스 관련 이벤트 리스너
      socket.on('user_status', (data: UserStatus) => {
        console.log('User status update:', data);
        setUserStatuses((prev) => {
          const newStatuses = new Map(prev);
          newStatuses.set(data.userId, data);
          return newStatuses;
        });
      });

      socket.on('read_receipt', (data) => {
        console.log('Read receipt received:', data);
        // 읽음 상태 동기화 처리
      });

      socket.on('user_typing_sync', (data) => {
        console.log('User typing sync received:', data);
        // 타이핑 상태 동기화 처리
      });

      socket.on('devices', (data) => {
        console.log('Devices info received:', data);
        setDevices(data.devices || []);
        setDeviceCount(data.connectionCount || 0);
      });

      socket.on('connection_stats', (data) => {
        console.log('Connection stats received:', data);
        // 연결 통계 처리
      });

      socketRef.current = socket;

      // 수동으로 연결 시작
      console.log('🚀 Attempting to connect socket...', {
        isMobile,
        transports: isMobile ? ['polling'] : ['websocket', 'polling'],
        timeout: isMobile ? 30000 : 10000,
        apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      });

      // 모바일에서 연결 전 네트워크 테스트 (이미 위에서 URL 테스트를 했으므로 생략)
      console.log('🚀 Attempting to connect socket...', {
        isMobile,
        backendUrl,
        transports: isMobile ? ['polling'] : ['websocket', 'polling'],
        timeout: isMobile ? 30000 : 10000,
      });

      socket.connect();
    } catch (error) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.error('Failed to create socket connection:', error);
      console.error('Connection error details:', {
        error,
        isMobile,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
      setIsConnected(false);
    }
  }, [session?.accessToken, session?.refreshToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      retryCountRef.current = 0; // 연결 해제 시 재시도 카운터 리셋
    }
  }, []);

  // 강제 재연결 함수 (모바일용)
  const forceReconnect = useCallback(async () => {
    console.log('🚀 Force reconnecting socket...');
    console.log('📱 Mobile force reconnect initiated');
    setIsConnected(false);
    retryCountRef.current = 0;

    // 기존 소켓 완전 정리
    if (socketRef.current) {
      console.log('🧹 Cleaning up existing socket completely');
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // 캐시된 백엔드 URL 초기화 (새로 테스트하도록)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      delete (window as any).workingBackendUrl;
    }

    // 재연결 시도
    setTimeout(() => {
      console.log('🔄 Starting force reconnect after cleanup');
      connect();
    }, 1000);
  }, [connect]);

  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join', { roomId });
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave', { roomId });
    }
  }, []);

  const sendMessage = useCallback((roomId: string, text: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send', { roomId, text });
    }
  }, []);

  const sendTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { roomId, isTyping });
    }
  }, []);

  // 멀티 디바이스 관련 함수들
  const syncRead = useCallback((roomId: string, messageId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sync_read', { roomId, messageId });
    }
  }, []);

  const syncTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sync_typing', { roomId, isTyping });
    }
  }, []);

  const getDevices = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_devices');
    }
  }, []);

  const getConnectionStats = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_connection_stats');
    }
  }, []);

  // 세션 상태에 따른 연결 관리
  useEffect(() => {
    if (session?.accessToken && !isConnected && !socketRef.current) {
      connect();
    } else if (!session?.accessToken) {
      disconnect();
    }
  }, [session?.accessToken, isConnected, connect, disconnect]);

  // 모바일에서 네트워크 상태 변경 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('Network is online, attempting to reconnect...');
      if (session?.accessToken && !isConnected) {
        setTimeout(() => {
          connect();
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log('Network is offline');
      setIsConnected(false);
    };

    // 모바일에서만 네트워크 상태 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [session?.accessToken, isConnected, connect]);

  return {
    socket: socketRef.current,
    isConnected,
    setIsConnected,
    isReconnecting,
    setIsReconnecting,
    connect,
    disconnect,
    forceReconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    canConnect: !!session?.accessToken,
    // 멀티 디바이스 관련 기능
    deviceCount,
    devices,
    userStatuses,
    syncRead,
    syncTyping,
    getDevices,
    getConnectionStats,
    // AI 서비스 오류
    aiServiceError,
    // 연결 디버그 정보
    connectionDebugInfo,
    setConnectionDebugInfo,
  };
};
