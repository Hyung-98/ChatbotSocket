import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
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

  private getRequestResponse(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    return { req: request, res: response };
  }

  private getIp(request: any): string {
    return (
      request.ip ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.headers['x-forwarded-for']?.split(',')[0] ||
      'unknown'
    );
  }
}
