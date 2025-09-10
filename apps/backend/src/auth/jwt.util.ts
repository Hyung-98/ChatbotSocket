import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class JwtUtil {
  /**
   * JWT 토큰 생성
   */
  static sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  /**
   * JWT 토큰 검증
   */
  static verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw new Error('Invalid token');
    }
  }

  /**
   * JWT 토큰 디코딩 (검증 없이)
   */
  static decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * 토큰 만료 확인
   */
  static isExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded || !decoded.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  /**
   * 토큰에서 사용자 ID 추출
   */
  static getUserId(token: string): string | null {
    try {
      const decoded = this.verify(token);
      return decoded.sub;
    } catch {
      return null;
    }
  }

  /**
   * 토큰에서 이메일 추출
   */
  static getEmail(token: string): string | null {
    try {
      const decoded = this.verify(token);
      return decoded.email;
    } catch {
      return null;
    }
  }
}
