import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
export declare class AuthJwtService {
    private prisma;
    constructor(prisma: PrismaService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateUser(userId: string): Promise<UserWithoutPassword | null>;
    verifyToken(token: string): Promise<UserWithoutPassword | null>;
    getUserFromToken(token: string): Promise<UserWithoutPassword | null>;
}
