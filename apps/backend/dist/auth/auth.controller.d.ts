import { AuthService } from './auth.service';
import type { LoginDto, RegisterDto, AuthResponse } from './dto/auth.dto';
import type { UserWithoutPassword } from './types/user.types';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    getProfile(req: {
        user: UserWithoutPassword;
    }): UserWithoutPassword;
    getUsers(): Promise<UserWithoutPassword[]>;
}
