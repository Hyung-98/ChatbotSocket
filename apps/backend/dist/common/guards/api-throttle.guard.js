"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiThrottleGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const redis_service_1 = require("../../redis/redis.service");
let ApiThrottleGuard = class ApiThrottleGuard {
    redisService;
    constructor(redisService) {
        this.redisService = redisService;
    }
    async canActivate(context) {
        const { req, res } = this.getRequestResponse(context);
        const ip = this.getIp(req);
        const key = `api:${ip}`;
        const limit = 100;
        const ttl = 60;
        const redis = this.redisService.getClient();
        if (!redis) {
            return true;
        }
        try {
            const current = await redis.incr(key);
            if (current === 1) {
                await redis.expire(key, ttl);
            }
            if (current > limit) {
                throw new throttler_1.ThrottlerException();
            }
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
            res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());
            return true;
        }
        catch (error) {
            if (error instanceof throttler_1.ThrottlerException) {
                throw error;
            }
            return true;
        }
    }
    getRequestResponse(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        return { req: request, res: response };
    }
    getIp(request) {
        return (request.ip ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.headers['x-forwarded-for']?.split(',')[0] ||
            'unknown');
    }
};
exports.ApiThrottleGuard = ApiThrottleGuard;
exports.ApiThrottleGuard = ApiThrottleGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], ApiThrottleGuard);
//# sourceMappingURL=api-throttle.guard.js.map