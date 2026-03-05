'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { SendHorizontal, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-background">
      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask me anything..."
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none rounded-2xl border border-[var(--border-subtle)]',
            'bg-surface px-4 py-2.5 text-sm text-foreground',
            'focus:outline-none focus:ring-1 focus:ring-[var(--border-subtle)]',
            'placeholder:text-muted disabled:opacity-50 min-h-[44px]',
            'transition-shadow'
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label={disabled ? '생성 중' : '전송'}
          className={cn(
            'rounded-xl w-11 h-11 flex items-center justify-center shrink-0',
            'bg-accent text-[var(--bg-surface)]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'hover:opacity-80 transition-opacity'
          )}
        >
          {disabled ? (
            <Square size={16} fill="currentColor" />
          ) : (
            <SendHorizontal size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
