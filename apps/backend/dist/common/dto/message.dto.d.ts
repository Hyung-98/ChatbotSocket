export declare class SendMessageDto {
    text: string;
    roomId: string;
}
export declare class JoinRoomDto {
    roomId: string;
}
export declare class CreateRoomDto {
    name: string;
    description?: string;
}
export declare class TypingDto {
    roomId: string;
    status: 'start' | 'stop';
}
