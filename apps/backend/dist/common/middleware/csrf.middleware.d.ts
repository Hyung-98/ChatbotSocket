import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';
export declare class CsrfMiddleware implements NestMiddleware {
    private readonly redisService;
    constructor(redisService: RedisService);
    use(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare class CsrfTokenGenerator {
    private readonly redisService;
    constructor(redisService: RedisService);
    generateToken(): string;
    storeToken(sessionId: string, token: string, ttl?: number): Promise<void>;
    validateToken(sessionId: string, token: string): Promise<boolean>;
    removeToken(sessionId: string): Promise<void>;
}
