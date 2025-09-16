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
exports.LongMessageThrottlerGuard = exports.RoomThrottlerGuard = exports.SpamThrottlerGuard = exports.TypingThrottlerGuard = exports.MessageThrottlerGuard = exports.SocketThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const redis_service_1 = require("../../redis/redis.service");
let SocketThrottlerGuard = class SocketThrottlerGuard {
    redisService;
    options;
    constructor(redisService, options = { limit: 10, ttl: 60 }) {
        this.redisService = redisService;
        this.options = options;
    }
    async canActivate(context) {
        const client = context.switchToWs().getClient();
        const clientData = client.data;
        const userId = clientData?.user?.id;
        if (!userId)
            return true;
        const event = context.getHandler().name;
        const key = `throttle:${userId}:${event}`;
        const redis = this.redisService.getClient();
        if (!redis)
            return true;
        try {
            const current = await redis.incr(key);
            if (current === 1) {
                await redis.expire(key, this.options.ttl);
            }
            if (current > this.options.limit) {
                throw new throttler_1.ThrottlerException();
            }
            return true;
        }
        catch (error) {
            if (error instanceof throttler_1.ThrottlerException) {
                throw error;
            }
            return true;
        }
    }
};
exports.SocketThrottlerGuard = SocketThrottlerGuard;
exports.SocketThrottlerGuard = SocketThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService, Object])
], SocketThrottlerGuard);
let MessageThrottlerGuard = class MessageThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService) {
        super(redisService, { limit: 10, ttl: 60 });
    }
};
exports.MessageThrottlerGuard = MessageThrottlerGuard;
exports.MessageThrottlerGuard = MessageThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], MessageThrottlerGuard);
let TypingThrottlerGuard = class TypingThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService) {
        super(redisService, { limit: 20, ttl: 60 });
    }
};
exports.TypingThrottlerGuard = TypingThrottlerGuard;
exports.TypingThrottlerGuard = TypingThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], TypingThrottlerGuard);
let SpamThrottlerGuard = class SpamThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService) {
        super(redisService, { limit: 3, ttl: 10 });
    }
};
exports.SpamThrottlerGuard = SpamThrottlerGuard;
exports.SpamThrottlerGuard = SpamThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], SpamThrottlerGuard);
let RoomThrottlerGuard = class RoomThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService) {
        super(redisService, { limit: 5, ttl: 60 });
    }
};
exports.RoomThrottlerGuard = RoomThrottlerGuard;
exports.RoomThrottlerGuard = RoomThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], RoomThrottlerGuard);
let LongMessageThrottlerGuard = class LongMessageThrottlerGuard extends SocketThrottlerGuard {
    constructor(redisService) {
        super(redisService, { limit: 2, ttl: 300 });
    }
};
exports.LongMessageThrottlerGuard = LongMessageThrottlerGuard;
exports.LongMessageThrottlerGuard = LongMessageThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], LongMessageThrottlerGuard);
//# sourceMappingURL=throttle.guard.js.map