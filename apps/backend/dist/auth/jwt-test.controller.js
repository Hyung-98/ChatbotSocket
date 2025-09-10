"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtTestController = void 0;
const common_1 = require("@nestjs/common");
const jwt_util_1 = require("./jwt.util");
let JwtTestController = class JwtTestController {
    createToken(body) {
        const token = jwt_util_1.JwtUtil.sign({
            sub: body.userId,
            email: body.email,
        });
        return {
            token,
            message: 'Token created successfully',
        };
    }
    verifyToken(auth) {
        if (!auth || !auth.startsWith('Bearer ')) {
            return { error: 'No token provided' };
        }
        const token = auth.substring(7);
        try {
            const payload = jwt_util_1.JwtUtil.verify(token);
            return {
                valid: true,
                payload,
                message: 'Token is valid',
            };
        }
        catch {
            return {
                valid: false,
                error: 'Invalid token',
            };
        }
    }
    decodeToken(auth) {
        if (!auth || !auth.startsWith('Bearer ')) {
            return { error: 'No token provided' };
        }
        const token = auth.substring(7);
        const decoded = jwt_util_1.JwtUtil.decode(token);
        return {
            decoded,
            isExpired: jwt_util_1.JwtUtil.isExpired(token),
        };
    }
    getTokenInfo(auth) {
        if (!auth || !auth.startsWith('Bearer ')) {
            return { error: 'No token provided' };
        }
        const token = auth.substring(7);
        return {
            userId: jwt_util_1.JwtUtil.getUserId(token),
            email: jwt_util_1.JwtUtil.getEmail(token),
            isExpired: jwt_util_1.JwtUtil.isExpired(token),
        };
    }
};
exports.JwtTestController = JwtTestController;
__decorate([
    (0, common_1.Post)('create-token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], JwtTestController.prototype, "createToken", null);
__decorate([
    (0, common_1.Get)('verify-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JwtTestController.prototype, "verifyToken", null);
__decorate([
    (0, common_1.Get)('decode-token'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JwtTestController.prototype, "decodeToken", null);
__decorate([
    (0, common_1.Get)('token-info'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], JwtTestController.prototype, "getTokenInfo", null);
exports.JwtTestController = JwtTestController = __decorate([
    (0, common_1.Controller)('jwt-test')
], JwtTestController);
//# sourceMappingURL=jwt-test.controller.js.map