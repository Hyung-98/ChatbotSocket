import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string, isTyping: boolean) => void;
}

export const useSocket = (): UseSocketReturn => {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const retryCountRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!session?.accessToken) {
      console.warn('No access token available');
      return;
    }

    console.log('Attempting socket connection with token:', {
      hasToken: !!session?.accessToken,
      tokenLength: session?.accessToken?.length,
      tokenStart: session?.accessToken?.substring(0, 20) + '...',
    });

    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    // 기존 소켓이 있다면 정리
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      const socket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat`, {
        auth: {
          token: session?.accessToken,
        },
        transports: ['websocket', 'polling'],
        autoConnect: false, // 수동 연결로 변경
        timeout: 20000, // 연결 타임아웃 증가
      });

      socket.on('connect', () => {
        console.log('Socket connected - waiting for authentication');
        // connect 이벤트는 단순히 소켓 연결만 의미, 인증은 별도
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
        retryCountRef.current = 0; // 연결이 끊어지면 재시도 카운터 리셋
      });

      socket.on('connected', (data) => {
        console.log('Authenticated and connected:', data);
        setIsConnected(true); // 인증 성공 시에만 연결 상태로 설정
        retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        setIsConnected(false);

        // 인증 오류인 경우 재연결 시도 (최대 3회)
        if (
          (error.message === '인증되지 않은 사용자입니다.' ||
            error.message === '유효하지 않은 토큰입니다.' ||
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

      socket.on('userJoined', (data) => {
        console.log('User joined:', data);
      });

      socket.on('userLeft', (data) => {
        console.log('User left:', data);
      });

      socket.on('userTyping', (data) => {
        console.log('User typing:', data);
      });

      socketRef.current = socket;

      // 수동으로 연결 시작
      socket.connect();
    } catch (error) {
      console.error('Failed to create socket connection:', error);
    }
  }, [session?.accessToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      retryCountRef.current = 0; // 연결 해제 시 재시도 카운터 리셋
    }
  }, []);

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

  // 세션이 변경되거나 토큰이 있을 때 자동 연결
  useEffect(() => {
    if (session?.accessToken) {
      // 토큰이 준비될 때까지 더 오래 대기
      const timer = setTimeout(() => {
        connect();
      }, 1000); // 500ms -> 1000ms로 증가

      return () => clearTimeout(timer);
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [session?.accessToken, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
  };
};
