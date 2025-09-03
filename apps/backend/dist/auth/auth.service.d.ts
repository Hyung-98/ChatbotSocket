import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateUser(userId: string): Promise<UserWithoutPassword | null>;
    getAllUsers(): Promise<UserWithoutPassword[]>;
}
