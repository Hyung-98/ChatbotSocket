"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputSanitizationMiddleware = exports.SecurityMiddleware = void 0;
const common_1 = require("@nestjs/common");
const helmet_1 = __importDefault(require("helmet"));
let SecurityMiddleware = class SecurityMiddleware {
    use(req, res, next) {
        (0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'ws:', 'wss:'],
                },
            },
            crossOriginEmbedderPolicy: false,
        })(req, res, next);
    }
};
exports.SecurityMiddleware = SecurityMiddleware;
exports.SecurityMiddleware = SecurityMiddleware = __decorate([
    (0, common_1.Injectable)()
], SecurityMiddleware);
let InputSanitizationMiddleware = class InputSanitizationMiddleware {
    use(req, res, next) {
        if (req.body) {
            this.sanitizeObject(req.body);
        }
        if (req.query) {
            this.sanitizeObject(req.query);
        }
        if (req.params) {
            this.sanitizeObject(req.params);
        }
        next();
    }
    sanitizeObject(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .trim();
            }
            else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.sanitizeObject(obj[key]);
            }
        }
    }
};
exports.InputSanitizationMiddleware = InputSanitizationMiddleware;
exports.InputSanitizationMiddleware = InputSanitizationMiddleware = __decorate([
    (0, common_1.Injectable)()
], InputSanitizationMiddleware);
//# sourceMappingURL=security.middleware.js.map