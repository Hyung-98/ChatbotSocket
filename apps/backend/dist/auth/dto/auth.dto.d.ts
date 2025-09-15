export interface LoginDto {
    email: string;
    password: string;
}
export interface RegisterDto {
    email: string;
    password: string;
    name: string;
}
export interface AuthResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    accessToken: string;
    refreshToken: string;
}
export interface RefreshTokenDto {
    refreshToken: string;
}
export interface RefreshTokenResponse {
    accessToken: string;
}
