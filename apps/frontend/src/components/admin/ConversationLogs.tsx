'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '../../hooks/useTheme';

interface ConversationMessage {
  id: string;
  content: string;
  role: string;
  userName: string | null;
  userEmail: string | null;
  roomName: string;
  roomId: string;
  createdAt: string;
}

interface ConversationLogsProps {
  onSelectRoom?: (roomId: string) => void;
}

export default function ConversationLogs({ onSelectRoom }: ConversationLogsProps) {
  const { data: session } = useSession();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({
    roomId: '',
    userId: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  const fetchMessages = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        ...filters,
      });

      const response = await fetch(`/api/admin/conversations?${params}`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation logs');
      }

      const data = await response.json();

      if (reset) {
        setMessages(data.messages);
      } else {
        setMessages((prev) => [...prev, ...data.messages]);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error fetching conversation logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchMessages(1, true);
    }
  }, [session, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(nextPage, false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return theme === 'dark'
          ? 'bg-blue-900/30 text-blue-300 border-blue-700'
          : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assistant':
        return theme === 'dark'
          ? 'bg-green-900/30 text-green-300 border-green-700'
          : 'bg-green-100 text-green-800 border-green-200';
      default:
        return theme === 'dark'
          ? 'bg-gray-700 text-gray-300 border-gray-600'
          : 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">대화 로그 모니터링</h2>

        {/* 필터 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">룸 ID</label>
            <input
              type="text"
              value={filters.roomId}
              onChange={(e) => handleFilterChange('roomId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="룸 ID로 필터링"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">사용자 ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="사용자 ID로 필터링"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작 날짜</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료 날짜</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">검색어</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="메시지 내용 검색"
            />
          </div>
        </div>

        {/* 결과 통계 */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">총 {total}개의 메시지가 있습니다.</div>
      </div>

      {/* 메시지 목록 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">메시지 목록</h3>

          {loading && messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">로딩 중...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-200"
                  onClick={() => onSelectRoom?.(message.roomId)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(message.role)}`}
                      >
                        {message.role === 'user' ? '사용자' : 'AI'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {message.userName || '시스템'}
                      </span>
                      {message.userEmail && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">({message.userEmail})</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(message.createdAt)}</span>
                  </div>

                  <div className="mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">룸: </span>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{message.roomName}</span>
                  </div>

                  <div className="text-gray-800 dark:text-gray-200">
                    {message.content.length > 200 ? `${message.content.substring(0, 200)}...` : message.content}
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="text-center py-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors duration-200"
                  >
                    {loading ? '로딩 중...' : '더 보기'}
                  </button>
                </div>
              )}

              {messages.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">메시지가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
