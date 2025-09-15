export declare class SanitizerUtil {
    static stripHtml(html: string): string;
    static escapeHtml(text: string): string;
    static sanitizeHtml(html: string): string;
    static sanitizeMessage(message: string): string;
    static validateInput(input: string, options?: {
        minLength?: number;
        maxLength?: number;
        allowSpecialChars?: boolean;
        allowedChars?: RegExp;
    }): {
        isValid: boolean;
        error?: string;
    };
    static sanitizeForSql(input: string): string;
    static sanitizeUrl(url: string): string | null;
    static sanitizeEmail(email: string): string | null;
}
