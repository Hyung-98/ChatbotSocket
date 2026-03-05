'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Menu, Settings, LogOut } from 'lucide-react';
import type { Conversation } from '@/lib/types';
import { SystemPromptModal } from './SystemPromptModal';
import { cn } from '@/lib/utils';

interface Props {
  conversation: Conversation;
  onToggleSidebar: () => void;
  onSystemPromptSaved: (prompt: string) => void;
}

export function ConversationHeader({
  conversation,
  onToggleSidebar,
  onSystemPromptSaved,
}: Props) {
  const { data: session } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.slice(0, 1).toUpperCase()
    : session?.user?.email
    ? session.user.email.slice(0, 1).toUpperCase()
    : 'U';

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-background shrink-0">
      {/* Left: hamburger */}
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl hover:bg-[var(--bg-surface-alt)] transition-colors"
        aria-label="대화 목록 열기"
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {/* Center: title */}
      <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
        {conversation.title}
      </h1>

      {/* Right: avatar with dropdown */}
      <div className="relative" ref={avatarRef}>
        <button
          onClick={() => setShowAvatarMenu((v) => !v)}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center',
            'bg-accent text-[var(--bg-surface)] text-sm font-semibold',
            'hover:opacity-80 transition-opacity shrink-0'
          )}
          aria-label="사용자 메뉴"
        >
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt="avatar"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </button>

        {showAvatarMenu && (
          <div className={cn(
            'absolute top-full right-0 mt-2 w-48 rounded-xl z-40',
            'bg-surface border border-[var(--border-subtle)] shadow-lg overflow-hidden'
          )}>
            {session?.user?.email && (
              <div className="px-4 py-2.5 border-b border-[var(--border-subtle)]">
                <p className="text-xs text-muted truncate">{session.user.email}</p>
              </div>
            )}
            <button
              onClick={() => {
                setShowAvatarMenu(false);
                setShowModal(true);
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm',
                'hover:bg-[var(--bg-surface-alt)] transition-colors text-left',
                conversation.systemPrompt ? 'text-foreground font-medium' : 'text-foreground/70'
              )}
            >
              <Settings size={15} />
              시스템 프롬프트
              {conversation.systemPrompt && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              )}
            </button>
            <button
              onClick={() => {
                setShowAvatarMenu(false);
                signOut({ callbackUrl: '/login' });
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/70 hover:bg-[var(--bg-surface-alt)] transition-colors text-left"
            >
              <LogOut size={15} />
              로그아웃
            </button>
          </div>
        )}
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
