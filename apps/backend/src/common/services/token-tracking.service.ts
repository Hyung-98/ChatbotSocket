import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TokenUsageData {
  userId?: string;
  roomId?: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestId?: string;
}

@Injectable()
export class TokenTrackingService {
  private readonly logger = new Logger(TokenTrackingService.name);

  // 토큰 가격 정보 (USD per 1K tokens)
  private readonly pricing: Record<
    string,
    Record<string, { input: number; output: number }>
  > = {
    openai: {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    },
    anthropic: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    },
  };

  constructor(private prisma: PrismaService) {}

  async trackTokenUsage(data: TokenUsageData): Promise<void> {
    try {
      await this.prisma.tokenUsage.create({
        data: {
          userId: data.userId,
          roomId: data.roomId,
          provider: data.provider,
          model: data.model,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          estimatedCost: data.estimatedCost,
          requestId: data.requestId,
        },
      });

      this.logger.log(
        `Token usage tracked: ${data.provider}/${data.model} - ${data.totalTokens} tokens ($${data.estimatedCost.toFixed(4)})`,
      );
    } catch (error) {
      this.logger.error('Failed to track token usage:', error);
    }
  }

  calculateCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const providerPricing = this.pricing[provider];
    if (!providerPricing) {
      this.logger.warn(`Unknown provider: ${provider}`);
      return 0;
    }

    const modelPricing = providerPricing[model];
    if (!modelPricing) {
      this.logger.warn(`Unknown model: ${provider}/${model}`);
      return 0;
    }

    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  async getTokenUsageStats(options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    roomId?: string;
    provider?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.roomId) {
      where.roomId = options.roomId;
    }

    if (options.provider) {
      where.provider = options.provider;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {} as any;
      if (options.startDate) {
        (where.createdAt as any).gte = options.startDate;
      }
      if (options.endDate) {
        (where.createdAt as any).lte = options.endDate;
      }
    }

    const [totalUsage, usageByProvider, usageByModel, dailyUsage, userUsage] =
      await Promise.all([
        this.prisma.tokenUsage.aggregate({
          where,
          _sum: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _count: { id: true },
        }),
        this.prisma.tokenUsage.groupBy({
          by: ['provider'],
          where,
          _sum: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _count: { id: true },
        }),
        this.prisma.tokenUsage.groupBy({
          by: ['provider', 'model'],
          where,
          _sum: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _count: { id: true },
        }),
        this.getDailyUsageStats(where),
        this.getUserUsageStats(where),
      ]);

    return {
      total: {
        requests: totalUsage._count.id,
        promptTokens: totalUsage._sum.promptTokens || 0,
        completionTokens: totalUsage._sum.completionTokens || 0,
        totalTokens: totalUsage._sum.totalTokens || 0,
        estimatedCost: totalUsage._sum.estimatedCost || 0,
      },
      byProvider: usageByProvider.map((item) => ({
        provider: item.provider,
        requests: item._count.id,
        promptTokens: item._sum.promptTokens || 0,
        completionTokens: item._sum.completionTokens || 0,
        totalTokens: item._sum.totalTokens || 0,
        estimatedCost: item._sum.estimatedCost || 0,
      })),
      byModel: usageByModel.map((item) => ({
        provider: item.provider,
        model: item.model,
        requests: item._count.id,
        promptTokens: item._sum.promptTokens || 0,
        completionTokens: item._sum.completionTokens || 0,
        totalTokens: item._sum.totalTokens || 0,
        estimatedCost: item._sum.estimatedCost || 0,
      })),
      dailyUsage,
      userUsage,
    };
  }

  private async getDailyUsageStats(where: Record<string, unknown>) {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const dailyStats = await this.prisma.tokenUsage.groupBy({
      by: ['createdAt'],
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
      _count: { id: true },
    });

    const dailyMap = new Map<
      string,
      { date: string; tokens: number; cost: number; requests: number }
    >();
    dailyStats.forEach((stat) => {
      const date = stat.createdAt.toISOString().split('T')[0];
      dailyMap.set(date, {
        date,
        tokens: stat._sum.totalTokens || 0,
        cost: stat._sum.estimatedCost || 0,
        requests: stat._count.id,
      });
    });

    return last30Days.map((date) => ({
      date,
      tokens: dailyMap.get(date)?.tokens || 0,
      cost: dailyMap.get(date)?.cost || 0,
      requests: dailyMap.get(date)?.requests || 0,
    }));
  }

  private async getUserUsageStats(where: Record<string, unknown>) {
    return this.prisma.tokenUsage.groupBy({
      by: ['userId'],
      where,
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
      _count: { id: true },
      orderBy: {
        _sum: {
          totalTokens: 'desc',
        },
      },
      take: 10,
    });
  }

  async getCostProjection(days: number = 30): Promise<{
    projectedDailyCost: number;
    projectedMonthlyCost: number;
    currentDailyAverage: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recentUsage = await this.prisma.tokenUsage.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _sum: {
        estimatedCost: true,
      },
    });

    const totalCost = recentUsage._sum.estimatedCost || 0;
    const dailyAverage = totalCost / days;

    return {
      projectedDailyCost: dailyAverage,
      projectedMonthlyCost: dailyAverage * 30,
      currentDailyAverage: dailyAverage,
    };
  }
}
