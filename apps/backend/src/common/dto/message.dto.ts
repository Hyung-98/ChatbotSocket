import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(2000, { message: 'Message too long (max 2000 characters)' })
  text: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Room name cannot be empty' })
  @MaxLength(100, { message: 'Room name too long (max 100 characters)' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description too long (max 500 characters)' })
  description?: string;
}

export class TypingDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Typing status too long' })
  status: 'start' | 'stop';
}
