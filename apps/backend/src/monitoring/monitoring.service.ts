import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CustomLoggerService } from './logger.service';

export interface SystemMetrics {
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
  timestamp: Date;
}

export interface PerformanceMetrics {
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

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly performanceMetrics: Array<{
    timestamp: Date;
    responseTime: number;
    endpoint: string;
    method: string;
  }> = [];

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private customLogger: CustomLoggerService,
  ) {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    // CPU 사용률 (Node.js에서는 제한적)
    const cpuUsage = process.cpuUsage();
    const os = await import('os');
    const loadAverage = os.loadavg();

    // 메모리 사용량
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // 데이터베이스 상태 확인
    const dbStartTime = Date.now();
    let dbConnected = false;
    let dbResponseTime = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
      dbResponseTime = Date.now() - dbStartTime;
    } catch (error) {
      this.customLogger.error(
        '데이터베이스 연결 실패',
        (error as Error).stack,
        'MonitoringService',
      );
    }

    // Redis 상태 확인
    const redisStartTime = Date.now();
    let redisConnected = false;
    let redisResponseTime = 0;
    let redisMemoryUsage = 0;
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        await redisClient.ping();
        redisConnected = true;
        redisResponseTime = Date.now() - redisStartTime;

        // Redis 메모리 사용량 조회
        const info = await redisClient.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          redisMemoryUsage = parseInt(memoryMatch[1]);
        }
      }
    } catch (error) {
      this.customLogger.error(
        'Redis 연결 실패',
        (error as Error).stack,
        'MonitoringService',
      );
    }

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // 마이크로초를 초로 변환
        loadAverage,
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: totalMemory,
        free: freeMemory,
        usage: (memoryUsage.heapUsed / totalMemory) * 100,
      },
      database: {
        connected: dbConnected,
        responseTime: dbResponseTime,
        activeConnections: 0, // PostgreSQL에서는 복잡한 쿼리 필요
      },
      redis: {
        connected: redisConnected,
        responseTime: redisResponseTime,
        memoryUsage: redisMemoryUsage,
      },
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 최근 1시간의 성능 데이터 필터링
    const recentMetrics = this.performanceMetrics.filter(
      (metric) => metric.timestamp.getTime() > oneHourAgo,
    );

    // 응답 시간 통계
    const responseTimes = recentMetrics.map((m) => m.responseTime);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const sortedResponseTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

    const p95ResponseTime = sortedResponseTimes[p95Index] || 0;
    const p99ResponseTime = sortedResponseTimes[p99Index] || 0;

    // 처리량 계산
    const requestsPerSecond = recentMetrics.length / 3600; // 1시간당 요청 수를 초당으로 변환

    // 에러율 계산
    const errorLogs = await this.customLogger.getErrorLogs(1000);
    const recentErrors = errorLogs.filter(
      (log) => log.timestamp.getTime() > oneHourAgo,
    );

    const totalErrors = recentErrors.length;
    const totalRequests = recentMetrics.length;
    const errorRate =
      totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      responseTime: {
        average: averageResponseTime,
        p95: p95ResponseTime,
        p99: p99ResponseTime,
      },
      throughput: {
        requestsPerSecond,
        messagesPerSecond: 0, // 별도로 추적 필요
      },
      errorRate: {
        percentage: errorRate,
        totalErrors,
        totalRequests,
      },
    };
  }

  recordPerformanceMetric(
    responseTime: number,
    endpoint: string,
    method: string,
  ) {
    this.performanceMetrics.push({
      timestamp: new Date(),
      responseTime,
      endpoint,
      method,
    });

    // 최근 1시간 데이터만 유지
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filteredMetrics = this.performanceMetrics.filter(
      (metric) => metric.timestamp.getTime() > oneHourAgo,
    );
    this.performanceMetrics.length = 0;
    this.performanceMetrics.push(...filteredMetrics);
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: boolean;
      redis: boolean;
      memory: boolean;
      cpu: boolean;
    };
    message: string;
  }> {
    const metrics = await this.getSystemMetrics();

    const checks = {
      database: metrics.database.connected,
      redis: metrics.redis.connected,
      memory: metrics.memory.usage < 90, // 메모리 사용률 90% 미만
      cpu: metrics.cpu.loadAverage[0] < 4, // 1분 평균 로드 4 미만
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (healthyChecks === totalChecks) {
      status = 'healthy';
      message = '모든 시스템이 정상 작동 중입니다.';
    } else if (healthyChecks >= totalChecks * 0.5) {
      status = 'degraded';
      message = '일부 시스템에 문제가 있습니다.';
    } else {
      status = 'unhealthy';
      message = '시스템에 심각한 문제가 있습니다.';
    }

    return { status, checks, message };
  }

  async getAlerts(): Promise<
    Array<{
      id: string;
      level: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      timestamp: Date;
      resolved: boolean;
    }>
  > {
    const alerts: Array<{
      id: string;
      level: 'info' | 'warning' | 'error' | 'critical';
      message: string;
      timestamp: Date;
      resolved: boolean;
    }> = [];
    const metrics = await this.getSystemMetrics();

    // 메모리 사용률 경고
    if (metrics.memory.usage > 80) {
      alerts.push({
        id: 'memory-high',
        level: metrics.memory.usage > 95 ? 'critical' : 'warning',
        message: `메모리 사용률이 ${metrics.memory.usage.toFixed(1)}%입니다.`,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // CPU 로드 경고
    if (metrics.cpu.loadAverage[0] > 2) {
      alerts.push({
        id: 'cpu-high',
        level: metrics.cpu.loadAverage[0] > 4 ? 'critical' : 'warning',
        message: `CPU 로드가 ${metrics.cpu.loadAverage[0].toFixed(2)}입니다.`,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 데이터베이스 연결 실패
    if (!metrics.database.connected) {
      alerts.push({
        id: 'database-down',
        level: 'critical',
        message: '데이터베이스 연결이 실패했습니다.',
        timestamp: new Date(),
        resolved: false,
      });
    }

    // Redis 연결 실패
    if (!metrics.redis.connected) {
      alerts.push({
        id: 'redis-down',
        level: 'critical',
        message: 'Redis 연결이 실패했습니다.',
        timestamp: new Date(),
        resolved: false,
      });
    }

    return alerts;
  }
}
