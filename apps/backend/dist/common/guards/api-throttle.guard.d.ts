import { ExecutionContext, CanActivate } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
export declare class ApiThrottleGuard implements CanActivate {
    private readonly redisService;
    constructor(redisService: RedisService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private getRequestResponse;
    private getIp;
}
