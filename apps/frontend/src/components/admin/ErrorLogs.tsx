'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '../../hooks/useTheme';

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  context: string;
  metadata: any;
  timestamp: string;
}

interface ErrorStats {
  totalErrors: number;
  errorCounts: Record<string, number>;
  recentErrors: ErrorLog[];
}

export default function ErrorLogs() {
  const { data: session } = useSession();
  const { theme } = useTheme();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({
    level: '',
    startDate: '',
    endDate: '',
  });

  const fetchLogs = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        ...filters,
      });

      const response = await fetch(`/api/admin/logs/errors?${params}`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch error logs');
      }

      const data = await response.json();

      if (reset) {
        setLogs(data.logs);
      } else {
        setLogs((prev) => [...prev, ...data.logs]);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error fetching error logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/logs/errors/stats', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching error stats:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchLogs(1, true);
      fetchStats();
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
      fetchLogs(nextPage, false);
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

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'fatal':
        return theme === 'dark'
          ? 'bg-red-900/30 text-red-300 border-red-700'
          : 'bg-red-100 text-red-800 border-red-200';
      case 'error':
        return theme === 'dark'
          ? 'bg-red-900/30 text-red-300 border-red-700'
          : 'bg-red-100 text-red-800 border-red-200';
      case 'warn':
        return theme === 'dark'
          ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return theme === 'dark'
          ? 'bg-blue-900/30 text-blue-300 border-blue-700'
          : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'debug':
        return theme === 'dark'
          ? 'bg-gray-700 text-gray-300 border-gray-600'
          : 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return theme === 'dark'
          ? 'bg-gray-700 text-gray-300 border-gray-600'
          : 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'fatal':
        return '치명적';
      case 'error':
        return '오류';
      case 'warn':
        return '경고';
      case 'info':
        return '정보';
      case 'debug':
        return '디버그';
      default:
        return level;
    }
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">총 에러 수</h3>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.totalErrors}</div>
          </div>

          {Object.entries(stats.errorCounts).map(([level, count]) => (
            <div
              key={level}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50"
            >
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{getLevelLabel(level)}</h3>
              <div
                className={`text-2xl font-bold ${
                  level === 'fatal' || level === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : level === 'warn'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : level === 'info'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {count}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">에러 로그 모니터링</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">로그 레벨</label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">모든 레벨</option>
              <option value="fatal">치명적</option>
              <option value="error">오류</option>
              <option value="warn">경고</option>
              <option value="info">정보</option>
              <option value="debug">디버그</option>
            </select>
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
        </div>

        {/* 결과 통계 */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">총 {total}개의 로그가 있습니다.</div>
      </div>

      {/* 로그 목록 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg dark:shadow-xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">에러 로그 목록</h3>

          {loading && logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">로딩 중...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(log.level)}`}>
                        {getLevelLabel(log.level)}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{log.context}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(log.timestamp)}</span>
                  </div>

                  <div className="text-gray-800 dark:text-gray-200 mb-2">{log.message}</div>

                  {log.metadata && (
                    <details className="text-xs text-gray-600 dark:text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                        메타데이터 보기
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto text-gray-800 dark:text-gray-200">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
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

              {logs.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">에러 로그가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
