"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface Props {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
}

export function MessageBubble({
  message,
  isStreaming,
  streamingContent,
}: Props) {
  const isUser = message.role === "USER";
  const content = isStreaming ? (streamingContent ?? "") : message.content;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-surface rounded-tr-sm text-foreground"
            : "bg-[var(--bg-surface-alt)] rounded-tl-sm text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div
            className={cn(
              "prose prose-sm max-w-none",
              "prose-p:my-1 prose-p:leading-relaxed prose-p:text-foreground",
              "prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-foreground",
              "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
              "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:text-foreground",
              "prose-blockquote:border-l-[var(--border-subtle)] prose-blockquote:text-muted",
              "prose-strong:font-semibold prose-strong:text-foreground",
              "prose-code:before:content-none prose-code:after:content-none",
              "prose-code:bg-[var(--bg-surface-alt)] prose-code:text-foreground",
              "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-inherit",
              "prose-pre:bg-[var(--accent)] prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:my-2",
              "prose-pre:p-4 prose-pre:text-xs",
              "prose-table:text-xs prose-table:border-collapse",
              "prose-th:border prose-th:border-[var(--border-subtle)] prose-th:px-2 prose-th:py-1 prose-th:bg-[var(--bg-surface-alt)]",
              "prose-td:border prose-td:border-[var(--border-subtle)] prose-td:px-2 prose-td:py-1",
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children }) {
                  return (
                    <pre className="bg-accent rounded-xl overflow-x-auto p-4 text-xs leading-5 my-2">
                      {children}
                    </pre>
                  );
                },
                code({ className, children, ...props }) {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code
                        className={cn(className, "text-xs font-mono text-[var(--bg-surface)]")}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="bg-[var(--bg-surface-alt)] px-1 py-0.5 rounded text-xs font-mono text-foreground"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-current ml-0.5 align-middle animate-pulse-slow" />
        )}
      </div>
    </div>
  );
}
