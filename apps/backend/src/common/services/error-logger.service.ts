import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ErrorLogData {
  level: 'error' | 'warn' | 'info' | 'debug' | 'fatal';
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  roomId?: string;
  stack?: string;
}

@Injectable()
export class ErrorLoggerService {
  private readonly logger = new Logger(ErrorLoggerService.name);

  constructor(private prisma: PrismaService) {}

  async logError(errorData: ErrorLogData): Promise<void> {
    try {
      // 데이터베이스에 에러 로그 저장
      await this.prisma.logEntry.create({
        data: {
          level: errorData.level,
          message: errorData.message,
          context: errorData.context || 'application',
          metadata: errorData.metadata
            ? JSON.stringify(errorData.metadata)
            : null,
        },
      });

      // 콘솔에도 로그 출력
      const logMessage = `[${errorData.level.toUpperCase()}] ${errorData.message}`;
      const logContext = {
        context: errorData.context,
        userId: errorData.userId,
        roomId: errorData.roomId,
        metadata: errorData.metadata,
      };

      switch (errorData.level) {
        case 'fatal':
        case 'error':
          this.logger.error(
            logMessage,
            errorData.stack,
            JSON.stringify(logContext),
          );
          break;
        case 'warn':
          this.logger.warn(logMessage, JSON.stringify(logContext));
          break;
        case 'info':
          this.logger.log(logMessage, JSON.stringify(logContext));
          break;
        case 'debug':
          this.logger.debug(logMessage, JSON.stringify(logContext));
          break;
      }
    } catch (dbError) {
      // 데이터베이스 저장 실패 시에도 콘솔에는 로그 출력
      this.logger.error('Failed to save error log to database', dbError);
      this.logger.error(
        `Original error: ${errorData.message}`,
        errorData.stack,
      );
    }
  }

  async getErrorLogs(options: {
    skip?: number;
    take?: number;
    level?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {};

    if (options.level) {
      where.level = options.level;
    }

    if (options.startDate || options.endDate) {
      where.timestamp = {} as Record<string, unknown>;
      if (options.startDate) {
        (where.timestamp as Record<string, unknown>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.timestamp as Record<string, unknown>).lte = options.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.logEntry.findMany({
        where,
        skip: options.skip || 0,
        take: options.take || 50,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.logEntry.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
      total,
      hasMore: (options.skip || 0) + (options.take || 50) < total,
    };
  }

  async getErrorStats(options: { startDate?: Date; endDate?: Date }) {
    const where: Record<string, unknown> = {};

    if (options.startDate || options.endDate) {
      where.timestamp = {} as Record<string, unknown>;
      if (options.startDate) {
        (where.timestamp as Record<string, unknown>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.timestamp as Record<string, unknown>).lte = options.endDate;
      }
    }

    const [totalErrors, errorCounts, recentErrors] = await Promise.all([
      this.prisma.logEntry.count({
        where: {
          ...where,
          level: { in: ['error', 'fatal'] },
        },
      }),
      this.prisma.logEntry.groupBy({
        by: ['level'],
        where,
        _count: { level: true },
      }),
      this.prisma.logEntry.findMany({
        where: {
          ...where,
          level: { in: ['error', 'fatal'] },
        },
        take: 10,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    return {
      totalErrors,
      errorCounts: errorCounts.reduce(
        (acc, item) => {
          acc[item.level] = item._count.level;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentErrors: recentErrors.map((log) => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      })),
    };
  }

  async clearOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.logEntry.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleared ${result.count} old log entries older than ${daysToKeep} days`,
    );
  }
}
