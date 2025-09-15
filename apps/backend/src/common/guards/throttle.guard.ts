import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

interface ThrottlerOptions {
  limit: number;
  ttl: number; // seconds
}

@Injectable()
export class SocketThrottlerGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly options: ThrottlerOptions = { limit: 10, ttl: 60 },
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const userId = client.data?.user?.id;

    if (!userId) return true; // 인증되지 않은 요청은 다른 가드에서 처리

    const event = context.getHandler().name;
    const key = `throttle:${userId}:${event}`;

    const redis = this.redisService.getClient();
    if (!redis) return true; // Redis가 없으면 통과

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, this.options.ttl);
      }

      if (current > this.options.limit) {
        throw new ThrottlerException();
      }

      return true;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw error;
      }
      // Redis 에러 시 통과 (서비스 가용성 우선)
      return true;
    }
  }
}

@Injectable()
export class MessageThrottlerGuard extends SocketThrottlerGuard {
  constructor(redisService: RedisService) {
    super(redisService, { limit: 10, ttl: 60 }); // 1분에 10개 메시지
  }
}

@Injectable()
export class TypingThrottlerGuard extends SocketThrottlerGuard {
  constructor(redisService: RedisService) {
    super(redisService, { limit: 20, ttl: 60 }); // 1분에 20개 타이핑 이벤트
  }
}

// 짧은 시간 내 메시지 전송 제한 (스팸 방지)
@Injectable()
export class SpamThrottlerGuard extends SocketThrottlerGuard {
  constructor(redisService: RedisService) {
    super(redisService, { limit: 3, ttl: 10 }); // 10초에 3개 메시지
  }
}

// 룸 조인/나가기 제한
@Injectable()
export class RoomThrottlerGuard extends SocketThrottlerGuard {
  constructor(redisService: RedisService) {
    super(redisService, { limit: 5, ttl: 60 }); // 1분에 5번 룸 변경
  }
}

// 긴 메시지 전송 제한 (2000자 이상)
@Injectable()
export class LongMessageThrottlerGuard extends SocketThrottlerGuard {
  constructor(redisService: RedisService) {
    super(redisService, { limit: 2, ttl: 300 }); // 5분에 2개 긴 메시지
  }
}
