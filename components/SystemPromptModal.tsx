'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  conversationId: string;
  currentPrompt: string | null | undefined;
  onSave: (prompt: string) => void;
  onClose: () => void;
}

export function SystemPromptModal({ conversationId, currentPrompt, onSave, onClose }: Props) {
  const [value, setValue] = useState(currentPrompt ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: value }),
      });
      onSave(value);
      onClose();
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold">시스템 프롬프트</h2>
        <p className="text-sm text-gray-500">
          AI의 역할과 행동 방식을 설정합니다. 비워두면 기본 동작을 사용합니다.
        </p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          placeholder="예: 당신은 친절한 한국어 선생님입니다. 모든 답변은 한국어로 해주세요."
          className={cn(
            'w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-900 px-4 py-3 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
