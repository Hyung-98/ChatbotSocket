'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
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
    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-background">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-900 px-4 py-2.5 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'placeholder:text-gray-400 disabled:opacity-50 min-h-[44px]'
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-medium text-white',
            'bg-blue-600 hover:bg-blue-700',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors h-[44px] shrink-0'
          )}
        >
          {disabled ? '생성 중...' : '전송'}
        </button>
      </div>
    </div>
  );
}
