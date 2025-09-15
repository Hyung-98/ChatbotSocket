import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
export declare class AdminGuard implements CanActivate {
    private jwtAuthGuard;
    constructor(jwtAuthGuard: JwtAuthGuard);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class SuperAdminGuard implements CanActivate {
    private jwtAuthGuard;
    constructor(jwtAuthGuard: JwtAuthGuard);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
