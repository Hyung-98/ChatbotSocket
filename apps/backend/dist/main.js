"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const helmet_1 = __importDefault(require("helmet"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'ws:', 'wss:'],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'same-origin' },
    }));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001',
                /^http:\/\/192\.168\.\d+\.\d+:3000$/,
                /^http:\/\/192\.168\.\d+\.\d+:3001$/,
                /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
                /^http:\/\/10\.\d+\.\d+\.\d+:3001$/,
            ];
            if (!origin)
                return callback(null, true);
            const isAllowed = allowedOrigins.some((allowedOrigin) => {
                if (typeof allowedOrigin === 'string') {
                    return origin === allowedOrigin;
                }
                return allowedOrigin.test(origin);
            });
            if (isAllowed) {
                callback(null, true);
            }
            else {
                callback(new Error('CORS 정책에 의해 차단되었습니다.'), false);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-CSRF-Token',
            'X-Session-Id',
        ],
        exposedHeaders: [
            'Content-Length',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ],
        preflightContinue: false,
        optionsSuccessStatus: 200,
        maxAge: 86400,
    });
    await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map