import { Injectable, LoggerService, LogLevel, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface LogEntry {
  id?: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class CustomLoggerService implements LoggerService {
  private readonly logger = new Logger(CustomLoggerService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  log(message: string, context?: string, metadata?: Record<string, any>) {
    this.writeLog('log', message, context, metadata);
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    metadata?: Record<string, any>,
  ) {
    this.writeLog('error', message, context, { ...metadata, trace });
  }

  warn(message: string, context?: string, metadata?: Record<string, any>) {
    this.writeLog('warn', message, context, metadata);
  }

  debug(message: string, context?: string, metadata?: Record<string, any>) {
    this.writeLog('debug', message, context, metadata);
  }

  verbose(message: string, context?: string, metadata?: Record<string, any>) {
    this.writeLog('verbose', message, context, metadata);
  }

  private async writeLog(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      metadata,
    };

    // 콘솔에 출력
    this.logger[level](message, context);

    // Redis에 실시간 로그 저장 (최근 1000개)
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const logKey = 'recent_logs';
        await redisClient.lPush(logKey, JSON.stringify(logEntry));
        await redisClient.lTrim(logKey, 0, 999); // 최근 1000개만 유지
        await redisClient.expire(logKey, 86400); // 24시간 후 만료
      }
    } catch (error) {
      this.logger.error('Redis 로그 저장 실패:', error);
    }

    // 에러 레벨인 경우 데이터베이스에도 저장
    if (level === 'error') {
      try {
        await this.prisma.logEntry.create({
          data: {
            level,
            message,
            context: context || 'Unknown',
            metadata: metadata ? JSON.stringify(metadata) : null,
            timestamp: logEntry.timestamp,
          },
        });
      } catch (error) {
        this.logger.error('데이터베이스 로그 저장 실패:', error);
      }
    }
  }

  async getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const logs = await redisClient.lRange('recent_logs', 0, limit - 1);
        return logs.map((log) => JSON.parse(log)).reverse(); // 최신순으로 정렬
      }
      return [];
    } catch (error) {
      this.logger.error('Redis 로그 조회 실패:', error);
      return [];
    }
  }

  async getErrorLogs(limit: number = 50): Promise<LogEntry[]> {
    try {
      const logs = await this.prisma.logEntry.findMany({
        where: { level: 'error' },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level as LogLevel,
        message: log.message,
        context: log.context,
        metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error('데이터베이스 에러 로그 조회 실패:', error);
      return [];
    }
  }

  async getSystemMetrics(): Promise<{
    totalLogs: number;
    errorLogs: number;
    warningLogs: number;
    recentActivity: LogEntry[];
  }> {
    try {
      const [totalLogs, errorLogs, warningLogs, recentActivity] =
        await Promise.all([
          this.prisma.logEntry.count(),
          this.prisma.logEntry.count({ where: { level: 'error' } }),
          this.prisma.logEntry.count({ where: { level: 'warn' } }),
          this.getRecentLogs(20),
        ]);

      return {
        totalLogs,
        errorLogs,
        warningLogs,
        recentActivity,
      };
    } catch (error) {
      this.logger.error('시스템 메트릭 조회 실패:', error);
      return {
        totalLogs: 0,
        errorLogs: 0,
        warningLogs: 0,
        recentActivity: [],
      };
    }
  }
}
