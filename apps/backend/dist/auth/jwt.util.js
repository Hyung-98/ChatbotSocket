"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtUtil = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
class JwtUtil {
    static sign(payload, options) {
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            ...options,
        });
    }
    static verify(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch {
            throw new Error('Invalid token');
        }
    }
    static decode(token) {
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch {
            return null;
        }
    }
    static isExpired(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp)
                return true;
            const currentTime = Math.floor(Date.now() / 1000);
            return decoded.exp < currentTime;
        }
        catch {
            return true;
        }
    }
    static getUserId(token) {
        try {
            const decoded = this.verify(token);
            return decoded.sub;
        }
        catch {
            return null;
        }
    }
    static getEmail(token) {
        try {
            const decoded = this.verify(token);
            return decoded.email;
        }
        catch {
            return null;
        }
    }
}
exports.JwtUtil = JwtUtil;
//# sourceMappingURL=jwt.util.js.map