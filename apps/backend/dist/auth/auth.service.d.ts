import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
export declare class AuthService {
    private prisma;
    private jwtService;
    private redisService;
    constructor(prisma: PrismaService, jwtService: JwtService, redisService: RedisService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateUser(userId: string): Promise<UserWithoutPassword | null>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    addToBlacklist(token: string, expiresIn: number): Promise<void>;
    isTokenBlacklisted(token: string): Promise<boolean>;
    logout(accessToken: string, refreshToken: string): Promise<void>;
    getAllUsers(): Promise<UserWithoutPassword[]>;
}
