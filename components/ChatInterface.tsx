'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Conversation, Message } from '@/lib/types';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

type ConversationWithMessages = Conversation & { messages: Message[] };

interface Props {
  initialConversation: ConversationWithMessages;
}

export function ChatInterface({ initialConversation }: Props) {
  const [currentConversation, setCurrentConversation] =
    useState<ConversationWithMessages>(initialConversation);

  const {
    conversations,
    loadConversations,
    createConversation,
    updateConversationTitle,
  } = useConversations();

  const handleTitleGenerated = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) return;
        const data: ConversationWithMessages = await res.json();
        updateConversationTitle(conversationId, data.title);
        if (currentConversation.id === conversationId) {
          setCurrentConversation((prev) => ({ ...prev, title: data.title }));
        }
      } catch (error) {
        console.error('Failed to refresh title:', error);
      }
    },
    [currentConversation.id, updateConversationTitle]
  );

  const { messages, isStreaming, streamingContent, sendMessage, resetMessages } = useChat(
    currentConversation.id,
    currentConversation.messages,
    { onTitleGenerated: handleTitleGenerated }
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewConversation = useCallback(async () => {
    const newConv = await createConversation();
    setCurrentConversation({ ...newConv, messages: [] });
    resetMessages([]);
  }, [createConversation, resetMessages]);

  const handleSwitch = useCallback(
    async (id: string) => {
      if (id === currentConversation.id) return;
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) return;
        const data: ConversationWithMessages = await res.json();
        setCurrentConversation(data);
        resetMessages(data.messages ?? []);
      } catch (error) {
        console.error('Failed to switch conversation:', error);
      }
    },
    [currentConversation.id, resetMessages]
  );

  const handleSystemPromptSaved = useCallback((prompt: string) => {
    setCurrentConversation((prev) => ({ ...prev, systemPrompt: prompt }));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <ConversationHeader
        conversation={currentConversation}
        conversations={conversations}
        onNewConversation={handleNewConversation}
        onSwitch={handleSwitch}
        onSystemPromptSaved={handleSystemPromptSaved}
      />
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
      />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
