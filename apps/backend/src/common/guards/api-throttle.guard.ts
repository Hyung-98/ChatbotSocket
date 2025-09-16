import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class ApiThrottleGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);
    const ip = this.getIp(req);
    const key = `api:${ip}`;
    const limit = 100; // 1분에 100회
    const ttl = 60; // 60초

    const redis = this.redisService.getClient();
    if (!redis) {
      // Redis가 없으면 허용
      return true;
    }

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, ttl);
      }

      if (current > limit) {
        throw new ThrottlerException();
      }

      // 응답 헤더에 제한 정보 추가
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + ttl * 1000).toISOString(),
      );

      return true;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw error;
      }
      // Redis 에러 시 허용
      return true;
    }
  }

  private getRequestResponse(context: ExecutionContext): {
    req: Request;
    res: Response;
  } {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    return { req: request, res: response };
  }

  private getIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    let forwardedIp: string | undefined;

    if (Array.isArray(forwardedFor)) {
      forwardedIp = forwardedFor[0];
    } else if (typeof forwardedFor === 'string') {
      forwardedIp = forwardedFor.split(',')[0];
    }

    // Express Request 타입 확장을 위한 안전한 접근
    const extendedRequest = request as Request & {
      ip?: string;
      connection?: { remoteAddress?: string };
      socket?: { remoteAddress?: string };
    };

    return (
      (extendedRequest.ip ||
        extendedRequest.connection?.remoteAddress ||
        extendedRequest.socket?.remoteAddress ||
        forwardedIp) ??
      'unknown'
    );
  }
}
