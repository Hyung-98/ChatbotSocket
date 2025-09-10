"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
let RedisService = class RedisService {
    client;
    async onModuleInit() {
        this.client = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
        });
        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });
        try {
            await this.client.connect();
            console.log('Redis client initialized successfully');
        }
        catch (error) {
            console.error('Failed to connect to Redis:', error);
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.disconnect();
        }
    }
    getClient() {
        return this.client || null;
    }
    async ping() {
        if (!this.client) {
            throw new Error('Redis client is not initialized');
        }
        return await this.client.ping();
    }
    async set(key, value, ttl) {
        if (ttl) {
            await this.client.setEx(key, ttl, value);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async get(key) {
        return await this.client.get(key);
    }
    async del(key) {
        return await this.client.del(key);
    }
    async exists(key) {
        return await this.client.exists(key);
    }
    async expire(key, seconds) {
        const result = await this.client.expire(key, seconds);
        return result === 1;
    }
    async keys(pattern) {
        return await this.client.keys(pattern);
    }
    async hSet(key, field, value) {
        return await this.client.hSet(key, field, value);
    }
    async hGet(key, field) {
        const result = await this.client.hGet(key, field);
        return result || undefined;
    }
    async hGetAll(key) {
        return await this.client.hGetAll(key);
    }
    async hDel(key, field) {
        return await this.client.hDel(key, field);
    }
    async publish(channel, message) {
        return await this.client.publish(channel, message);
    }
    async subscribe(channel, callback) {
        await this.client.subscribe(channel, callback);
    }
    async unsubscribe(channel) {
        await this.client.unsubscribe(channel);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)()
], RedisService);
//# sourceMappingURL=redis.service.js.map