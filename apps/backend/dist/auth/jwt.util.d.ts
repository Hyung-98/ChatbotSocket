import jwt from 'jsonwebtoken';
export interface JwtPayload {
    sub: string;
    email: string;
    iat?: number;
    exp?: number;
}
export declare class JwtUtil {
    static sign(payload: Omit<JwtPayload, 'iat' | 'exp'>, options?: jwt.SignOptions): string;
    static verify(token: string): JwtPayload;
    static decode(token: string): JwtPayload | null;
    static isExpired(token: string): boolean;
    static getUserId(token: string): string | null;
    static getEmail(token: string): string | null;
}
