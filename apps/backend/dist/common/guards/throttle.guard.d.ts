import { CanActivate, ExecutionContext } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
interface ThrottlerOptions {
    limit: number;
    ttl: number;
}
export declare class SocketThrottlerGuard implements CanActivate {
    private readonly redisService;
    private readonly options;
    constructor(redisService: RedisService, options?: ThrottlerOptions);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class MessageThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService: RedisService);
}
export declare class TypingThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService: RedisService);
}
export declare class SpamThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService: RedisService);
}
export declare class RoomThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService: RedisService);
}
export declare class LongMessageThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService: RedisService);
}
export {};
