'use client';

import { useState, useRef, useEffect } from 'react';
import type { Conversation } from '@/lib/types';
import { SystemPromptModal } from './SystemPromptModal';

interface Props {
  conversation: Conversation;
  conversations: Conversation[];
  onNewConversation: () => void;
  onSwitch: (id: string) => void;
  onSystemPromptSaved: (prompt: string) => void;
}

export function ConversationHeader({
  conversation,
  conversations,
  onNewConversation,
  onSwitch,
  onSystemPromptSaved,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-background shrink-0">
      <div className="flex items-center gap-2 min-w-0" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold max-w-[240px] truncate hover:text-blue-600 transition-colors"
          >
            <span className="truncate">{conversation.title}</span>
            <span className="text-gray-400 shrink-0">▾</span>
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-background shadow-lg z-40 max-h-80 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">대화 없음</div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSwitch(c.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 truncate transition-colors ${
                      c.id === conversation.id ? 'text-blue-600 font-medium' : ''
                    }`}
                  >
                    {c.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowModal(true)}
          title="시스템 프롬프트 설정"
          className={`rounded-lg p-2 transition-colors ${
            conversation.systemPrompt
              ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          ⚙️
        </button>
        <button
          onClick={onNewConversation}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          새 대화
        </button>
      </div>

      {showModal && (
        <SystemPromptModal
          conversationId={conversation.id}
          currentPrompt={conversation.systemPrompt}
          onSave={onSystemPromptSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </header>
  );
}
