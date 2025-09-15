'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '../../hooks/useSocket';
import { useRouter, useSearchParams } from 'next/navigation';
import ThemeToggle from '../../components/ThemeToggle';
import { useTheme } from '../../hooks/useTheme';

interface Message {
  id: string;
  userId: string | null;
  userName: string;
  text: string;
  roomId: string;
  timestamp: string;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function ChatContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    socket,
    isConnected,
    setIsConnected,
    forceReconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    aiServiceError,
    connectionDebugInfo,
    setConnectionDebugInfo,
  } = useSocket();
  const { mounted } = useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string>('general');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 채팅방 메시지 로드
  const loadRoomMessages = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`);
      if (response.ok) {
        const messagesData = await response.json();
        // 백엔드에서 { messages: [...], total, skip, take, room } 형태로 반환하므로 messages 배열만 추출
        const messagesArray = Array.isArray(messagesData) ? messagesData : messagesData.messages || [];
        setMessages(messagesArray);
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  }, []);

  // 세션 확인 및 리다이렉트
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  // URL 파라미터에서 roomId 확인
  useEffect(() => {
    const roomIdFromUrl = searchParams.get('room');
    if (roomIdFromUrl) {
      setCurrentRoomId(roomIdFromUrl);
    }
  }, [searchParams]);

  // 소켓 연결 및 자동 연결
  useEffect(() => {
    if (session && isConnected) {
      // 자동으로 현재 방에 조인
      joinRoom(currentRoomId);
      // 현재 방의 메시지 로드
      loadRoomMessages(currentRoomId);
    }
  }, [session, isConnected, currentRoomId, joinRoom, loadRoomMessages]);

  // 채팅방 목록 로드
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/rooms');
        if (response.ok) {
          const roomsData = await response.json();
          // 배열이 아닌 경우 빈 배열로 처리
          const roomsArray = Array.isArray(roomsData) ? roomsData : [];
          setRooms(roomsArray);

          // 현재 방 정보 설정
          const currentRoomData = roomsArray.find((room: Room) => room.id === currentRoomId);
          setCurrentRoom(currentRoomData || roomsArray[0]);

          // URL이 없는 경우 첫 번째 방으로 설정
          if (!searchParams.get('room') && roomsArray.length > 0) {
            setCurrentRoomId(roomsArray[0].id);
            router.replace(`/chat?room=${roomsArray[0].id}`);
          }
        }
      } catch (error) {
        console.error('채팅방 목록 로드 실패:', error);
      }
    };

    if (session) {
      loadRooms();
    }
  }, [session, currentRoomId, searchParams, router]);

  // 메시지 수신
  useEffect(() => {
    if (socket) {
      const handleMessage = (message: Message) => {
        // 현재 방의 메시지만 추가하고 중복 방지
        if (message.roomId === currentRoomId) {
          setMessages((prev) => {
            // 동일한 ID의 메시지가 이미 있는지 확인
            const exists = prev.some((msg) => msg.id === message.id);
            if (exists) {
              console.log('Duplicate message detected, skipping:', message.id);
              return prev;
            }

            // 서버에서 받은 메시지가 사용자 메시지인 경우, 임시 메시지를 실제 메시지로 교체
            if (message.userId === session?.user?.id) {
              console.log('Replacing temp message with server message:', message.id);
              return prev
                .map((msg) =>
                  msg.id.startsWith('temp-') && msg.userId === message.userId && msg.text === message.text
                    ? message // 임시 메시지를 서버 메시지로 교체
                    : msg,
                )
                .filter(
                  (msg, index, arr) =>
                    // 중복 제거: 같은 사용자의 같은 텍스트 메시지가 여러 개 있으면 하나만 유지
                    !msg.id.startsWith('temp-') ||
                    arr.findIndex((m) => m.userId === msg.userId && m.text === msg.text) === index,
                );
            }

            console.log('Adding message:', message.id, message.userName, message.text.substring(0, 50));
            return [...prev, message];
          });
        }
      };

      const handleStream = (data: { start?: boolean; token?: string; end?: boolean }) => {
        if (data.start) {
          setIsAiResponding(true);
          setAiResponse('');
        } else if (data.token) {
          setAiResponse((prev) => prev + data.token);
        } else if (data.end) {
          setIsAiResponding(false);
          // AI 응답은 이제 handleMessage에서 처리되므로 여기서는 상태만 초기화
          setAiResponse('');
        }
      };

      socket.on('message', handleMessage);
      socket.on('stream', handleStream);

      return () => {
        socket.off('message', handleMessage);
        socket.off('stream', handleStream);
      };
    }
  }, [socket, currentRoomId]);

  // 메시지 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiResponse]);

  // 채팅방 변경
  const handleRoomChange = async (roomId: string) => {
    if (roomId === currentRoomId) return;

    // 이전 방에서 나가기
    leaveRoom(currentRoomId);

    // 새 방으로 이동
    setCurrentRoomId(roomId);
    setMessages([]);
    setAiResponse('');
    setIsAiResponding(false);
    router.push(`/chat?room=${roomId}`);

    // 새 방에 조인
    joinRoom(roomId);

    // 새 방의 메시지 로드
    await loadRoomMessages(roomId);
  };

  // 새 채팅방 생성
  const handleCreateRoom = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '새 채팅방',
          description: '새로 생성된 채팅방입니다.',
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        setRooms((prev) => [...prev, newRoom]);
        handleRoomChange(newRoom.id);
      }
    } catch (error) {
      console.error('채팅방 생성 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지 전송
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !session || !isConnected) return;

    const messageText = message.trim();
    setMessage(''); // 입력 필드 즉시 비우기

    // 낙관적 업데이트: 사용자 메시지를 즉시 UI에 표시
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const userMessage: Message = {
      id: tempMessageId,
      userId: session.user.id,
      userName: session.user.name || session.user.email || '사용자',
      text: messageText,
      roomId: currentRoomId,
      timestamp: new Date().toISOString(),
    };

    // 메시지를 즉시 UI에 추가
    setMessages((prev) => [...prev, userMessage]);

    // 모바일에서 메시지 전송 후 자동 스크롤
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      // WebSocket을 통해 메시지 전송
      sendMessage(currentRoomId, messageText);

      // 첫 번째 메시지인 경우 채팅방 이름을 메시지로 업데이트
      if (messages.length === 0 && currentRoom?.name === '새 채팅방') {
        const summary = messageText.length > 20 ? messageText.substring(0, 20) + '...' : messageText;
        await fetch(`/api/rooms/${currentRoomId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: summary }),
        });

        // 로컬 상태 업데이트
        setRooms((prev) => prev.map((room) => (room.id === currentRoomId ? { ...room, name: summary } : room)));
        setCurrentRoom((prev) => (prev ? { ...prev, name: summary } : null));
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      // 전송 실패 시 임시 메시지 제거
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
    }
  };

  // 채팅방 삭제
  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 채팅방 클릭 이벤트 방지

    if (!confirm('정말로 이 채팅방을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 삭제된 채팅방을 목록에서 제거
        setRooms((prev) => prev.filter((room) => room.id !== roomId));

        // 현재 채팅방이 삭제된 경우 첫 번째 채팅방으로 이동
        if (roomId === currentRoomId) {
          const remainingRooms = rooms.filter((room) => room.id !== roomId);
          if (remainingRooms.length > 0) {
            // 첫 번째 남은 채팅방으로 이동
            const firstRoom = remainingRooms[0];
            setCurrentRoomId(firstRoom.id);
            setCurrentRoom(firstRoom);
            setMessages([]);
            setAiResponse('');
            setIsAiResponding(false);
            router.push(`/chat?room=${firstRoom.id}`);
            joinRoom(firstRoom.id);
            loadRoomMessages(firstRoom.id);
          } else {
            // 채팅방이 모두 삭제된 경우
            setCurrentRoom(null);
            setCurrentRoomId('');
            setMessages([]);
            setAiResponse('');
            setIsAiResponding(false);
            router.push('/chat');
          }
        }
      } else {
        alert('채팅방 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('채팅방 삭제 실패:', error);
      alert('채팅방 삭제 중 오류가 발생했습니다.');
    }
  };

  // 모바일 네트워크 정보 수집
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        const currentUrl = window.location.origin;

        // 모바일에서 가능한 백엔드 URL 목록
        const possibleUrls = [
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
          'http://192.168.1.97:3001',
          'http://192.168.1.126:3001',
          'http://192.168.1.100:3001',
          'http://10.0.0.1:3001',
        ];

        setNetworkInfo(`${currentUrl} → 여러 IP 시도 중...`);

        // 여러 URL을 순차적으로 시도
        const testBackendConnection = async (urls: string[], index = 0): Promise<void> => {
          if (index >= urls.length) {
            setConnectionDebugInfo('❌ 모든 백엔드 IP 연결 실패');
            setNetworkInfo(`${currentUrl} → 연결 실패`);
            console.log('❌ All backend URLs failed');
            return;
          }

          const testUrl = urls[index];
          console.log(`🔍 Testing backend URL ${index + 1}/${urls.length}: ${testUrl}`);

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

            const response = await fetch(`${testUrl}/health`, {
              method: 'GET',
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              console.log(`✅ Backend connection successful with: ${testUrl}`);
              console.log('📱 Mobile device detected:', navigator.userAgent);
              console.log('🔗 Network info:', `${window.location.origin} → ${testUrl}`);
              setConnectionDebugInfo(`✅ 백엔드 연결 성공: ${testUrl}`);
              setNetworkInfo(`${window.location.origin} → ${testUrl}`);

              // 성공한 URL을 환경 변수로 설정 (임시)
              (window as { workingBackendUrl?: string }).workingBackendUrl = testUrl;
            } else {
              console.log(`⚠️ Backend connection failed with ${testUrl}: ${response.status}`);
              // 다음 URL 시도
              testBackendConnection(urls, index + 1);
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ Backend connection error with ${testUrl}: ${errorMessage}`);
            // 다음 URL 시도
            testBackendConnection(urls, index + 1);
          }
        };

        // 백엔드 연결 테스트 시작
        testBackendConnection(possibleUrls);
      }
    }
  }, [setConnectionDebugInfo]);

  // 연결 상태 변경 시 재연결 로딩 상태 해제
  useEffect(() => {
    if (isConnected && isReconnecting) {
      setIsReconnecting(false);
      setConnectionDebugInfo('✅ 소켓 연결 성공!');
    } else if (!isConnected) {
      setConnectionDebugInfo('연결 끊김');
    }
  }, [isConnected, isReconnecting, setConnectionDebugInfo]);

  // 연결 시도 추적
  useEffect(() => {
    if (socket) {
      setLastConnectionAttempt(new Date());
    }
  }, [socket]);

  // 모바일에서 네트워크 상태 감지
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      const handleOnline = () => {
        console.log('📱 Network is online, attempting to reconnect...');
        setConnectionDebugInfo('네트워크 온라인 - 재연결 시도 중...');
        if (session?.accessToken && !isConnected) {
          setTimeout(() => {
            forceReconnect();
          }, 1000);
        }
      };

      const handleOffline = () => {
        console.log('📱 Network is offline');
        setConnectionDebugInfo('네트워크 오프라인');
        setIsConnected(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [session?.accessToken, isConnected, forceReconnect, setConnectionDebugInfo]);

  if (status === 'loading' || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="h-dvh mobile-viewport flex bg-gray-50 dark:bg-gray-900">
      {/* 모바일 오버레이 */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 왼쪽 사이드바 - 채팅방 목록 */}
      <div
        className={`w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative absolute inset-y-0 left-0 z-50`}
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">채팅방</h1>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              {/* 모바일에서 사이드바 닫기 버튼 */}
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 연결 상태 표시 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">{isConnected ? '연결됨' : '연결 끊김'}</span>
              {isReconnecting && (
                <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">재연결 중...</span>
              )}
            </div>

            {/* 디버그 정보 토글 버튼 */}
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {showDebugInfo ? '숨기기' : '디버그'}
            </button>
          </div>

          {/* 디버그 정보 */}
          {showDebugInfo && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
              <div>상태: {connectionDebugInfo}</div>
              <div>백엔드: {(window as { workingBackendUrl?: string }).workingBackendUrl || '자동 감지 중...'}</div>
              {lastConnectionAttempt && <div>마지막 시도: {lastConnectionAttempt.toLocaleTimeString()}</div>}
              <div>사용자 에이전트: {navigator.userAgent.substring(0, 50)}...</div>
            </div>
          )}
        </div>

        {/* 새 채팅방 생성 버튼 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            {isLoading ? '생성 중...' : '+ 새 채팅방'}
          </button>
        </div>

        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">채팅방이 없습니다.</p>
              <p className="text-xs mt-1">새 채팅방을 만들어보세요!</p>
            </div>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                className={`group relative p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  room.id === currentRoomId ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : ''
                }`}
              >
                <div
                  onClick={() => {
                    handleRoomChange(room.id);
                    // 모바일에서 채팅방 선택 시 사이드바 닫기
                    setIsMobileSidebarOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{room.name}</div>
                  {room.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{room.description}</div>
                  )}
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => handleDeleteRoom(room.id, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="채팅방 삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">{session.user.name || session.user.email}</div>
        </div>
      </div>

      {/* 오른쪽 메인 영역 - 채팅 */}
      <div className="flex-1 flex flex-col min-h-0 mobile-chat-container">
        {currentRoom ? (
          <>
            {/* 채팅 헤더 */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* 모바일에서 사이드바 열기 버튼 */}
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{currentRoom.name}</h2>
                      {/* 연결 상태 표시 */}
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    {currentRoom.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentRoom.description}</p>
                    )}
                    {!isConnected && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                        연결이 끊어졌습니다. 재연결을 시도하고 있습니다...
                      </p>
                    )}
                    {aiServiceError && (
                      <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          ⚠️ AI 서비스 오류: {aiServiceError}
                        </p>
                        <button
                          onClick={() => {
                            // AI 서비스 오류를 닫기 위해 소켓을 재연결
                            forceReconnect();
                          }}
                          className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 mt-1"
                        >
                          재시도
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* 모바일에서 새 채팅방 생성 버튼 */}
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="lg:hidden bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white p-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 min-h-0 overscroll-contain mobile-scroll-fix">
              {/* 디버깅 정보 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>방 ID: {currentRoomId}</span>
                    <div className="flex items-center space-x-2">
                      <span>메시지: {messages.length}</span>
                      <div
                        className={`flex items-center space-x-1 ${
                          isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs">{isConnected ? '연결됨' : '연결 안됨'}</span>
                        {!isConnected && (
                          <button
                            onClick={() => {
                              // 소켓 강제 재연결 시도
                              setIsReconnecting(true);
                              setConnectionDebugInfo('🔄 강제 재연결 시도 중...');
                              forceReconnect();

                              // 5초 후 로딩 상태 해제
                              setTimeout(() => {
                                setIsReconnecting(false);
                                if (!isConnected) {
                                  setConnectionDebugInfo('⚠️ 재연결 실패 - 네트워크 확인 필요');
                                }
                              }, 5000);
                            }}
                            disabled={isReconnecting}
                            className={`ml-1 text-xs hover:underline ${
                              isReconnecting
                                ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {isReconnecting ? '강제연결중...' : '강제재연결'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {networkInfo && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">네트워크: {networkInfo}</div>
                  )}
                  {connectionDebugInfo && (
                    <div className="text-xs text-blue-400 dark:text-blue-300 mt-1">진단: {connectionDebugInfo}</div>
                  )}
                  {!isConnected && (
                    <div className="text-xs text-orange-500 dark:text-orange-400 mt-1 space-y-1">
                      <div>💡 모바일에서 연결이 안되면 재연결 버튼을 눌러보세요</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        🔧 브라우저 개발자 도구 콘솔에서 상세 로그를 확인하세요
                      </div>
                      <div className="text-xs text-blue-400 dark:text-blue-300">
                        📱 모바일에서는 PC의 로컬 네트워크 IP (192.168.1.xxx)를 사용해야 합니다
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {messages.length === 0 && !isAiResponding ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500 dark:text-gray-400 text-center">
                    <p className="text-sm sm:text-base">아직 메시지가 없습니다.</p>
                    <p className="text-xs sm:text-sm mt-1">첫 번째 메시지를 보내보세요!</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.userId === session.user.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`${
                          msg.userId === session.user.id
                            ? 'max-w-xs lg:max-w-md'
                            : msg.userId === null
                              ? 'max-w-xs sm:max-w-md lg:max-w-2xl'
                              : 'max-w-xs lg:max-w-md'
                        } px-3 sm:px-4 py-2 rounded-lg ${
                          msg.userId === session.user.id
                            ? 'bg-blue-600 text-white'
                            : msg.userId === null
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <div className="font-medium text-xs sm:text-sm mb-1">{msg.userName}</div>
                        <div className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.text}</div>
                        <div className="text-xs opacity-70 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}

                  {/* AI 응답 진행 중 표시 */}
                  {isAiResponding && (
                    <div className="flex justify-start">
                      <div className="max-w-xs sm:max-w-md lg:max-w-2xl px-3 sm:px-4 py-2 rounded-lg bg-green-600 text-white">
                        <div className="font-medium text-xs sm:text-sm mb-1">AI Assistant</div>
                        <div className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                          {aiResponse}
                          <span className="animate-pulse">|</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 메시지 입력 */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-3 py-2 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm sm:text-base"
                  disabled={!isConnected}
                  onFocus={() => {
                    // 모바일에서 입력 필드 포커스 시 스크롤을 맨 아래로
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                  }}
                />
                <button
                  type="submit"
                  disabled={!message.trim() || !isConnected}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    !isConnected
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : !message.trim()
                        ? 'bg-blue-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title={!isConnected ? '연결이 필요합니다' : !message.trim() ? '메시지를 입력하세요' : '메시지 전송'}
                >
                  {!isConnected ? '연결 필요' : '전송'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400 text-center p-4">
              <p className="text-sm sm:text-base">채팅방을 선택해주세요</p>
              <p className="text-xs sm:text-sm mt-2 text-gray-400 dark:text-gray-500">
                왼쪽에서 채팅방을 선택하거나 새로 만들어보세요
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">로딩 중...</p>
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
