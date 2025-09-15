'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ThreadMessage {
  id: string;
  content: string;
  role: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

interface ConversationThreadProps {
  roomId: string;
  onClose?: () => void;
}

export default function ConversationThread({ roomId, onClose }: ConversationThreadProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (session && roomId) {
      fetchThread();
    }
  }, [session, roomId]);

  const fetchThread = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/conversations/${roomId}/thread`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation thread');
      }

      const data = await response.json();
      setMessages(data);

      // 첫 번째 메시지에서 룸 이름 추출
      if (data.length > 0) {
        setRoomName(data[0].roomName || 'Unknown Room');
      }
    } catch (error) {
      console.error('Error fetching conversation thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assistant':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'user':
        return '사용자';
      case 'assistant':
        return 'AI 어시스턴트';
      default:
        return '시스템';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">대화 스레드를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">대화 스레드: {roomName}</h2>
            <p className="text-sm text-gray-500">룸 ID: {roomId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">이 룸에는 메시지가 없습니다.</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {/* 메시지 헤더 */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(message.role)}`}>
                      {getRoleLabel(message.role)}
                    </span>
                    {message.userName && <span className="text-xs opacity-75">{message.userName}</span>}
                    <span className="text-xs opacity-75">{formatDate(message.createdAt)}</span>
                  </div>

                  {/* 메시지 내용 */}
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>총 {messages.length}개의 메시지</span>
            <button
              onClick={fetchThread}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
