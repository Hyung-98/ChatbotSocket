"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTimestamp = exports.generateId = void 0;
// 공통 유틸리티 함수
const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
};
exports.generateId = generateId;
const formatTimestamp = (date) => {
    return date.toISOString();
};
exports.formatTimestamp = formatTimestamp;
