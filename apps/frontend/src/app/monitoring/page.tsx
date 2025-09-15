'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '../../components/ThemeToggle';
// import { useTheme } from '../../hooks/useTheme';

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    free: number;
    usage: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
    activeConnections: number;
  };
  redis: {
    connected: boolean;
    responseTime: number;
    memoryUsage: number;
  };
  uptime: number;
  timestamp: string;
}

interface PerformanceMetrics {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    messagesPerSecond: number;
  };
  errorRate: {
    percentage: number;
    totalErrors: number;
    totalRequests: number;
  };
}

interface LogEntry {
  id?: string;
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export default function MonitoringPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  // const { theme: _theme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMonitoringData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsResponse, performanceResponse, logsResponse] = await Promise.all([
        fetch('/api/monitoring/metrics', {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }),
        fetch('/api/monitoring/performance', {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }),
        fetch('/api/monitoring/logs', {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }),
      ]);

      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json();
        setSystemMetrics(metrics);
      }

      if (performanceResponse.ok) {
        const performance = await performanceResponse.json();
        setPerformanceMetrics(performance);
      }

      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData);
      }
    } catch {
      // console.error('모니터링 데이터 로드 실패:', error);
    }
    setLoading(false);
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // 관리자 권한 확인
    if (session.user?.role !== 'ADMIN' && session.user?.role !== 'SUPER_ADMIN') {
      router.push('/');
      return;
    }

    loadMonitoringData();

    // 자동 새로고침 설정
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadMonitoringData, 5000); // 5초마다 새로고침
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session, status, router, autoRefresh, loadMonitoringData]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}일 ${hours}시간 ${minutes}분`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30';
      case 'info':
        return 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30';
      case 'debug':
        return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700';
      default:
        return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700';
    }
  };

  // 로딩 상태는 화면을 가리지 않고 인라인으로 표시

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">시스템 모니터링</h1>
            <div className="flex flex-col xs:flex-row sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center">
                <ThemeToggle />
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">자동 새로고침</span>
              </label>
              <button
                onClick={loadMonitoringData}
                disabled={loading}
                className={`px-4 py-2 rounded transition-colors w-full sm:w-auto flex items-center justify-center gap-2 ${
                  loading ? 'bg-blue-400 cursor-not-allowed text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {loading ? '새로고침 중...' : '새로고침'}
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors w-full sm:w-auto"
              >
                관리자 대시보드
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: '개요' },
              { id: 'performance', name: '성능' },
              { id: 'logs', name: '로그' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 로딩 상태 표시 */}
            {loading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-blue-700 dark:text-blue-300">시스템 메트릭을 불러오는 중...</span>
                </div>
              </div>
            )}

            {systemMetrics && (
              <div className="space-y-6">
                {/* 시스템 상태 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <svg
                          className="w-6 h-6 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">CPU 사용률</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {systemMetrics.cpu.loadAverage[0].toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <svg
                          className="w-6 h-6 text-green-600 dark:text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">메모리 사용률</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {systemMetrics.memory.usage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <div className="flex items-center">
                      <div
                        className={`p-2 rounded-lg ${systemMetrics.database.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
                      >
                        <svg
                          className={`w-6 h-6 ${systemMetrics.database.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">데이터베이스</p>
                        <p
                          className={`text-2xl font-semibold ${systemMetrics.database.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {systemMetrics.database.connected ? '연결됨' : '연결 실패'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <div className="flex items-center">
                      <div
                        className={`p-2 rounded-lg ${systemMetrics.redis.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
                      >
                        <svg
                          className={`w-6 h-6 ${systemMetrics.redis.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Redis</p>
                        <p
                          className={`text-2xl font-semibold ${systemMetrics.redis.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {systemMetrics.redis.connected ? '연결됨' : '연결 실패'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 정보 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">메모리 사용량</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">사용 중</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatBytes(systemMetrics.memory.used)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">전체</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatBytes(systemMetrics.memory.total)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">사용 가능</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatBytes(systemMetrics.memory.free)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            systemMetrics.memory.usage > 80
                              ? 'bg-red-500'
                              : systemMetrics.memory.usage > 60
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${systemMetrics.memory.usage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">시스템 정보</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">업타임</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatUptime(systemMetrics.uptime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">DB 응답 시간</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {systemMetrics.database.responseTime}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Redis 응답 시간</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {systemMetrics.redis.responseTime}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Redis 메모리</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatBytes(systemMetrics.redis.memoryUsage)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 성능 탭 */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* 로딩 상태 표시 */}
            {loading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-blue-700 dark:text-blue-300">성능 메트릭을 불러오는 중...</span>
                </div>
              </div>
            )}

            {performanceMetrics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">응답 시간</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">평균</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.responseTime.average.toFixed(2)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">P95</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.responseTime.p95.toFixed(2)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">P99</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.responseTime.p99.toFixed(2)}ms
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">처리량</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">요청/초</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.throughput.requestsPerSecond.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">메시지/초</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.throughput.messagesPerSecond.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">에러율</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">에러율</span>
                        <span
                          className={`text-sm font-medium ${
                            performanceMetrics.errorRate.percentage > 5
                              ? 'text-red-600 dark:text-red-400'
                              : performanceMetrics.errorRate.percentage > 1
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {performanceMetrics.errorRate.percentage.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">총 에러</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.errorRate.totalErrors}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300">총 요청</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {performanceMetrics.errorRate.totalRequests}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 로그 탭 */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* 로딩 상태 표시 */}
            {loading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-blue-700 dark:text-blue-300">로그를 불러오는 중...</span>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">시스템 로그</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={log.id || index}
                    className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLogLevelColor(log.level)}`}
                          >
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(log.timestamp)}</span>
                          {log.context && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">[{log.context}]</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">{log.message}</p>
                        {log.metadata && (
                          <pre className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
