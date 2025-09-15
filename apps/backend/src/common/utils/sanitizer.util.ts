import * as DOMPurify from 'isomorphic-dompurify';

export class SanitizerUtil {
  /**
   * HTML 태그를 제거하고 텍스트만 추출
   */
  static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * XSS 방지를 위한 HTML 이스케이핑
   */
  static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (s) => map[s]);
  }

  /**
   * DOMPurify를 사용한 HTML 정화
   */
  static sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [], // 모든 HTML 태그 제거
      ALLOWED_ATTR: [], // 모든 속성 제거
    });
  }

  /**
   * 메시지 내용 정화 (HTML 태그 제거 + 이스케이핑)
   */
  static sanitizeMessage(message: string): string {
    // 1. HTML 태그 제거
    let sanitized = this.stripHtml(message);

    // 2. HTML 이스케이핑
    sanitized = this.escapeHtml(sanitized);

    // 3. 연속된 공백 정리
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * 사용자 입력 검증 (길이, 특수문자 등)
   */
  static validateInput(
    input: string,
    options: {
      minLength?: number;
      maxLength?: number;
      allowSpecialChars?: boolean;
      allowedChars?: RegExp;
    } = {},
  ): { isValid: boolean; error?: string } {
    const {
      minLength = 1,
      maxLength = 2000,
      allowSpecialChars = true,
      allowedChars,
    } = options;

    // 길이 검증
    if (input.length < minLength) {
      return {
        isValid: false,
        error: `최소 ${minLength}자 이상 입력해주세요.`,
      };
    }

    if (input.length > maxLength) {
      return {
        isValid: false,
        error: `최대 ${maxLength}자까지 입력 가능합니다.`,
      };
    }

    // 특수문자 검증
    if (!allowSpecialChars) {
      const specialCharRegex = /[<>'"&]/;
      if (specialCharRegex.test(input)) {
        return { isValid: false, error: '특수문자는 사용할 수 없습니다.' };
      }
    }

    // 허용된 문자 검증
    if (allowedChars && !allowedChars.test(input)) {
      return {
        isValid: false,
        error: '허용되지 않은 문자가 포함되어 있습니다.',
      };
    }

    return { isValid: true };
  }

  /**
   * SQL 인젝션 방지를 위한 입력 정화
   */
  static sanitizeForSql(input: string): string {
    return input
      .replace(/['"\\]/g, '') // 따옴표와 백슬래시 제거
      .replace(/--/g, '') // SQL 주석 제거
      .replace(/\/\*/g, '') // 블록 주석 시작 제거
      .replace(/\*\//g, '') // 블록 주석 끝 제거
      .replace(/;/g, ''); // 세미콜론 제거
  }

  /**
   * URL 검증 및 정화
   */
  static sanitizeUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // 허용된 프로토콜만
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return null;
      }

      return urlObj.toString();
    } catch {
      return null;
    }
  }

  /**
   * 이메일 주소 정화 및 검증
   */
  static sanitizeEmail(email: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitized = email.trim().toLowerCase();

    if (!emailRegex.test(sanitized)) {
      return null;
    }

    return sanitized;
  }
}
