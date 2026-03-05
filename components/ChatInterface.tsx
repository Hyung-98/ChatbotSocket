'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import type { Conversation, Message } from '@/lib/types';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';

type ConversationWithMessages = Conversation & { messages: Message[] };

interface Props {
  initialConversation: ConversationWithMessages;
}

export function ChatInterface({ initialConversation }: Props) {
  const [currentConversation, setCurrentConversation] =
    useState<ConversationWithMessages>(initialConversation);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    setSidebarOpen(false);
  }, [createConversation, resetMessages]);

  const handleSwitch = useCallback(
    async (id: string) => {
      if (id === currentConversation.id) {
        setSidebarOpen(false);
        return;
      }
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) return;
        const data: ConversationWithMessages = await res.json();
        setCurrentConversation(data);
        resetMessages(data.messages ?? []);
        setSidebarOpen(false);
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
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 z-50 flex flex-col',
          'bg-surface border-r border-[var(--border-subtle)]',
          'transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
          <span className="text-sm font-semibold text-foreground">대화 목록</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors"
          >
            <X size={16} className="text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted">대화 없음</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSwitch(c.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm truncate transition-colors',
                  'hover:bg-[var(--bg-surface-alt)]',
                  c.id === currentConversation.id
                    ? 'font-semibold text-foreground'
                    : 'text-foreground/70'
                )}
              >
                {c.title}
              </button>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[var(--border-subtle)]">
          <button
            onClick={handleNewConversation}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium',
              'bg-accent text-[var(--bg-surface)] hover:opacity-90 transition-opacity'
            )}
          >
            <Plus size={16} />
            새 대화
          </button>
        </div>
      </aside>

      {/* Main layout */}
      <ConversationHeader
        conversation={currentConversation}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
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
