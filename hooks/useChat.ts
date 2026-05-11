'use client';

import { useState, useCallback } from 'react';
import type { Message, StreamResponse } from '@/lib/types';

interface UseChatOptions {
  onTitleGenerated?: (conversationId: string) => void;
}

export function useChat(
  conversationId: string,
  initialMessages: Message[],
  options?: UseChatOptions
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const optimisticUser: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'USER',
        content: text.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);
      setIsStreaming(true);
      setStreamingContent('');
      setError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: text.trim() }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: StreamResponse;
            try {
              event = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (event.type === 'content' && event.content) {
              accumulated += event.content;
              setStreamingContent(accumulated);
            } else if (event.type === 'done') {
              const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: 'ASSISTANT',
                content: accumulated,
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent('');
              setIsStreaming(false);

              if (event.conversationId) {
                options?.onTitleGenerated?.(event.conversationId);
              }
            } else if (event.type === 'error') {
              setError(event.error ?? '오류가 발생했습니다. 다시 시도해주세요.');
              setIsStreaming(false);
              setStreamingContent('');
              await reader.cancel();
              return;
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
        setIsStreaming(false);
        setStreamingContent('');
        setError('오류가 발생했습니다. 다시 시도해주세요.');
      }
    },
    [conversationId, isStreaming, options]
  );

  const resetMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
    setStreamingContent('');
    setIsStreaming(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { messages, isStreaming, streamingContent, error, clearError, sendMessage, resetMessages };
}
