import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // GET, HEAD, OPTIONS 요청은 CSRF 검사 제외
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // API 경로는 CSRF 검사 제외 (JWT 토큰으로 보호)
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      return next();
    }

    // CSRF 토큰 검증
    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionId = req.headers['x-session-id'] as string;

    if (!csrfToken || !sessionId) {
      throw new UnauthorizedException('CSRF 토큰이 필요합니다.');
    }

    // Redis에서 세션 검증
    const redis = this.redisService.getClient();
    if (redis) {
      const storedToken = await redis.get(`csrf:${sessionId}`);
      if (!storedToken || storedToken !== csrfToken) {
        throw new UnauthorizedException('유효하지 않은 CSRF 토큰입니다.');
      }
    }

    next();
  }
}

@Injectable()
export class CsrfTokenGenerator {
  constructor(private readonly redisService: RedisService) {}

  /**
   * CSRF 토큰 생성
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 세션에 CSRF 토큰 저장
   */
  async storeToken(
    sessionId: string,
    token: string,
    ttl: number = 3600,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    if (redis) {
      await redis.setEx(`csrf:${sessionId}`, ttl, token);
    }
  }

  /**
   * CSRF 토큰 검증
   */
  async validateToken(sessionId: string, token: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    if (!redis) return false;

    const storedToken = await redis.get(`csrf:${sessionId}`);
    return storedToken === token;
  }

  /**
   * CSRF 토큰 삭제
   */
  async removeToken(sessionId: string): Promise<void> {
    const redis = this.redisService.getClient();
    if (redis) {
      await redis.del(`csrf:${sessionId}`);
    }
  }
}
