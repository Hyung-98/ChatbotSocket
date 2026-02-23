export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date | string;
}

export interface Conversation {
  id: string;
  title: string;
  systemPrompt?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  messages?: Message[];
  _count?: { messages: number };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamResponse {
  type: 'content' | 'error' | 'done';
  content?: string;
  error?: string;
  conversationId?: string;
}

export interface CreateMessageRequest {
  conversationId: string;
  message: string;
}

export interface CreateMessageResponse {
  conversationId: string;
  message: Message;
}
