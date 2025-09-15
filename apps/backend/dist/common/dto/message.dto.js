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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypingDto = exports.CreateRoomDto = exports.JoinRoomDto = exports.SendMessageDto = void 0;
const class_validator_1 = require("class-validator");
class SendMessageDto {
    text;
    roomId;
}
exports.SendMessageDto = SendMessageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(1, { message: 'Message cannot be empty' }),
    (0, class_validator_1.MaxLength)(2000, { message: 'Message too long (max 2000 characters)' }),
    __metadata("design:type", String)
], SendMessageDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "roomId", void 0);
class JoinRoomDto {
    roomId;
}
exports.JoinRoomDto = JoinRoomDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], JoinRoomDto.prototype, "roomId", void 0);
class CreateRoomDto {
    name;
    description;
}
exports.CreateRoomDto = CreateRoomDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(1, { message: 'Room name cannot be empty' }),
    (0, class_validator_1.MaxLength)(100, { message: 'Room name too long (max 100 characters)' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(500, { message: 'Description too long (max 500 characters)' }),
    __metadata("design:type", String)
], CreateRoomDto.prototype, "description", void 0);
class TypingDto {
    roomId;
    status;
}
exports.TypingDto = TypingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], TypingDto.prototype, "roomId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(50, { message: 'Typing status too long' }),
    __metadata("design:type", String)
], TypingDto.prototype, "status", void 0);
//# sourceMappingURL=message.dto.js.map