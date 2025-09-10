'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '../../hooks/useSocket';
import { useRouter } from 'next/navigation';
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

interface UserEvent {
  userId: string;
  userName: string;
  roomId: string;
  timestamp: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { socket, isConnected, joinRoom, leaveRoom, sendMessage } = useSocket();
  const { theme, mounted } = useTheme();

  const [roomId, setRoomId] = useState('general');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // 메시지 컨테이너 참조
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 함수
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 텍스트 포맷팅 함수 (줄바꿈, 마크다운 스타일 적용)
  const formatMessageText = (text: string) => {
    return (
      text
        // 줄바꿈 처리
        .split('\n')
        .map((line, index) => {
          const trimmedLine = line.trim();

          // 빈 줄 처리
          if (!trimmedLine) {
            return <div key={index} className="h-3"></div>;
          }

          // 번호 목록 처리 (1. 2. 3. 등)
          if (/^\d+\.\s/.test(trimmedLine)) {
            return (
              <div key={index} className="flex items-start mt-2 first:mt-0">
                <span className="text-blue-500 dark:text-blue-400 font-medium mr-2 flex-shrink-0">
                  {trimmedLine.match(/^\d+/)?.[0]}.
                </span>
                <span className="flex-1">{trimmedLine.replace(/^\d+\.\s/, '')}</span>
              </div>
            );
          }

          // 불릿 포인트 처리 (- * • 등)
          if (/^[-*•]\s/.test(trimmedLine)) {
            return (
              <div key={index} className="flex items-start mt-2 first:mt-0">
                <span className="text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0">•</span>
                <span className="flex-1">{trimmedLine.replace(/^[-*•]\s/, '')}</span>
              </div>
            );
          }

          // 일반 텍스트
          return (
            <div key={index} className={index > 0 ? 'mt-2' : ''}>
              {trimmedLine}
            </div>
          );
        })
    );
  };

  // 메시지가 업데이트될 때마다 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // 인증 상태 확인
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  // 소켓 연결 상태에 따른 룸 자동 조인
  useEffect(() => {
    if (isConnected && !isInRoom) {
      console.log('Socket connected, joining room:', roomId);
      joinRoom(roomId);
      setIsInRoom(true);
    } else if (!isConnected && isInRoom) {
      console.log('Socket disconnected, leaving room');
      setIsInRoom(false);
    }
  }, [isConnected, isInRoom, joinRoom, roomId]);

  // 메시지 수신 처리
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message: Message) => {
      // AI 응답은 stream 이벤트로 처리하므로, 사용자 메시지만 처리
      if (message.userId !== null && message.userId !== 'system') {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleStream = (data: any) => {
      if (data.start) {
        // 스트리밍 시작
        setIsStreaming(true);
        const streamingId = `streaming-${Date.now()}`;
        setStreamingMessageId(streamingId);

        // 스트리밍 메시지 추가
        const streamingMessage: Message = {
          id: streamingId,
          userId: null,
          userName: 'AI Assistant',
          text: '',
          roomId,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, streamingMessage]);
      } else if (data.token) {
        // 토큰 추가
        setMessages((prevMessages) =>
          prevMessages.map((msg) => (msg.id === streamingMessageId ? { ...msg, text: msg.text + data.token } : msg)),
        );
      } else if (data.end) {
        // 스트리밍 종료
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    };

    const handleError = (error: any) => {
      console.error('Socket error:', error);
    };

    const handleUserJoined = (event: UserEvent) => {
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        userId: 'system',
        userName: 'System',
        text: `${event.userName}님이 입장했습니다.`,
        roomId: event.roomId,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    const handleUserLeft = (event: UserEvent) => {
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        userId: 'system',
        userName: 'System',
        text: `${event.userName}님이 퇴장했습니다.`,
        roomId: event.roomId,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, systemMessage]);
    };

    socket.on('message', handleMessage);
    socket.on('stream', handleStream);
    socket.on('error', handleError);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);

    return () => {
      socket.off('message', handleMessage);
      socket.off('stream', handleStream);
      socket.off('error', handleError);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
    };
  }, [socket, roomId, streamingMessageId]);

  const handleJoinRoom = () => {
    if (isInRoom) {
      leaveRoom(roomId);
      setIsInRoom(false);
    }

    setTimeout(() => {
      joinRoom(roomId);
      setIsInRoom(true);
      setMessages([]);
    }, 100);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isInRoom || isStreaming) return;

    sendMessage(roomId, message);
    setMessage('');

    // 메시지 전송 후 자동 스크롤
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div className="text-xl font-semibold text-gray-700">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto p-4">
        {/* 헤더 */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 lg:p-6 mb-4 lg:mb-6 border border-white/20 dark:border-slate-700/30 hover-lift smooth-transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  실시간 채팅
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">안전하고 빠른 메시징</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {session.user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{session.user?.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{session.user?.email}</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {isConnected ? '온라인' : '오프라인'}
                  </span>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* 채팅 영역 */}
          <div className="lg:col-span-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/30 flex flex-col h-[500px] lg:h-[600px] hover-lift smooth-transition">
            {/* 룸 선택 헤더 */}
            <div className="p-4 lg:p-6 border-b border-gray-200/50 dark:border-slate-600/30">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-4 h-4 lg:w-5 lg:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">채팅방</h2>
                    <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">#{roomId}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-3">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="룸 이름 입력"
                    className="flex-1 lg:flex-none px-3 lg:px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent smooth-transition text-sm"
                  />
                  <button
                    onClick={handleJoinRoom}
                    className={`px-4 lg:px-6 py-2 rounded-xl font-medium hover-lift smooth-transition text-sm ${
                      isInRoom
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                    }`}
                  >
                    {isInRoom ? '나가기' : '입장'}
                  </button>
                </div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-gradient-to-b from-gray-50/50 to-white/50 dark:from-slate-700/30 dark:to-slate-800/50 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-slate-600 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-medium">{isInRoom ? '메시지를 입력해보세요!' : '룸에 입장해주세요.'}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    {isInRoom ? '채팅을 시작해보세요' : '먼저 채팅방에 입장하세요'}
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.userId === session.user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm hover-lift smooth-transition ${
                        msg.userId === session.user?.id
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white message-enter-own'
                          : msg.userId === 'system'
                            ? 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-center mx-auto message-system'
                            : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-slate-600 message-enter'
                      }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {msg.userId !== 'system' && msg.userId !== session.user?.id && (
                        <div className="text-xs font-semibold mb-2 opacity-80">{msg.userName}</div>
                      )}
                      <div className={`text-sm leading-relaxed ${msg.userId === null ? 'ai-response' : ''}`}>
                        {msg.userId === null ? formatMessageText(msg.text) : msg.text}
                      </div>
                      <div className="text-xs mt-3 opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))
              )}
              {/* 자동 스크롤을 위한 참조 요소 */}
              <div ref={messagesEndRef} />
            </div>

            {/* 메시지 입력 */}
            <div className="p-4 lg:p-6 border-t border-gray-200/50 dark:border-slate-600/30 bg-white/50 dark:bg-slate-800/50">
              <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isStreaming
                        ? 'AI가 응답 중입니다...'
                        : isInRoom
                          ? '메시지를 입력하세요...'
                          : '먼저 룸에 입장하세요'
                    }
                    disabled={!isInRoom || isStreaming}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-600 disabled:cursor-not-allowed smooth-transition"
                  />
                  <button
                    type="submit"
                    disabled={!isInRoom || !message.trim() || isStreaming}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed smooth-transition hover-lift"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* 사이드바 - 연결 정보 */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-slate-700/30 p-6 hover-lift smooth-transition">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">연결 상태</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">소켓 상태</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isConnected
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}
                >
                  {isConnected ? '인증됨' : '연결 안됨'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">룸 상태</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isInRoom
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
                  }`}
                >
                  {isInRoom ? '입장됨' : '입장 안됨'}
                </span>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">소켓 ID</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                  {socket?.id || 'N/A'}
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">서버</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">테마</div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      theme === 'light' ? 'bg-yellow-400' : theme === 'dark' ? 'bg-slate-600' : 'bg-blue-500'
                    }`}
                  ></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {mounted
                      ? theme === 'light'
                        ? '라이트 모드'
                        : theme === 'dark'
                          ? '다크 모드'
                          : '시스템 설정'
                      : '로딩 중...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
