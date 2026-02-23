'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/lib/types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
}

export function MessageList({ messages, isStreaming, streamingContent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex h-full items-center justify-center text-gray-400 text-sm">
          메시지를 입력하여 대화를 시작하세요.
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <MessageBubble
          key="streaming"
          message={{ id: 'streaming', role: 'ASSISTANT', content: '', createdAt: '' }}
          isStreaming
          streamingContent={streamingContent}
        />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
