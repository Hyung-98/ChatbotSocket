export declare class JwtTestController {
    createToken(body: {
        userId: string;
        email: string;
    }): {
        token: string;
        message: string;
    };
    verifyToken(auth: string): {
        error: string;
        valid?: undefined;
        payload?: undefined;
        message?: undefined;
    } | {
        valid: boolean;
        payload: import("./jwt.util").JwtPayload;
        message: string;
        error?: undefined;
    } | {
        valid: boolean;
        error: string;
        payload?: undefined;
        message?: undefined;
    };
    decodeToken(auth: string): {
        error: string;
        decoded?: undefined;
        isExpired?: undefined;
    } | {
        decoded: import("./jwt.util").JwtPayload | null;
        isExpired: boolean;
        error?: undefined;
    };
    getTokenInfo(auth: string): {
        error: string;
        userId?: undefined;
        email?: undefined;
        isExpired?: undefined;
    } | {
        userId: string | null;
        email: string | null;
        isExpired: boolean;
        error?: undefined;
    };
}
