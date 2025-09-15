"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizerUtil = void 0;
const DOMPurify = __importStar(require("isomorphic-dompurify"));
class SanitizerUtil {
    static stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }
    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
        };
        return text.replace(/[&<>"'/]/g, (s) => map[s]);
    }
    static sanitizeHtml(html) {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
        });
    }
    static sanitizeMessage(message) {
        let sanitized = this.stripHtml(message);
        sanitized = this.escapeHtml(sanitized);
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
        return sanitized;
    }
    static validateInput(input, options = {}) {
        const { minLength = 1, maxLength = 2000, allowSpecialChars = true, allowedChars, } = options;
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
        if (!allowSpecialChars) {
            const specialCharRegex = /[<>'"&]/;
            if (specialCharRegex.test(input)) {
                return { isValid: false, error: '특수문자는 사용할 수 없습니다.' };
            }
        }
        if (allowedChars && !allowedChars.test(input)) {
            return {
                isValid: false,
                error: '허용되지 않은 문자가 포함되어 있습니다.',
            };
        }
        return { isValid: true };
    }
    static sanitizeForSql(input) {
        return input
            .replace(/['"\\]/g, '')
            .replace(/--/g, '')
            .replace(/\/\*/g, '')
            .replace(/\*\//g, '')
            .replace(/;/g, '');
    }
    static sanitizeUrl(url) {
        try {
            const urlObj = new URL(url);
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(urlObj.protocol)) {
                return null;
            }
            return urlObj.toString();
        }
        catch {
            return null;
        }
    }
    static sanitizeEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const sanitized = email.trim().toLowerCase();
        if (!emailRegex.test(sanitized)) {
            return null;
        }
        return sanitized;
    }
}
exports.SanitizerUtil = SanitizerUtil;
//# sourceMappingURL=sanitizer.util.js.map