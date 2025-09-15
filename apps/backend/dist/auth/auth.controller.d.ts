import { AuthService } from './auth.service';
import { CsrfTokenGenerator } from '../common/middleware/csrf.middleware';
import type { LoginDto, RegisterDto, AuthResponse, RefreshTokenDto, RefreshTokenResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
export declare class AuthController {
    private authService;
    private csrfTokenGenerator;
    constructor(authService: AuthService, csrfTokenGenerator: CsrfTokenGenerator);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    refreshToken(refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponse>;
    logout(req: {
        user: UserWithoutPassword;
        headers: {
            authorization: string;
        };
    }): Promise<{
        message: string;
    }>;
    getProfile(req: {
        user: UserWithoutPassword;
    }): UserWithoutPassword;
    getMe(req: {
        user: UserWithoutPassword;
    }): UserWithoutPassword;
    getCsrfToken(req: Request): Promise<{
        csrfToken: string;
        sessionId: string;
    }>;
    getUsers(): Promise<UserWithoutPassword[]>;
}
