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
          "max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-gray-100 dark:bg-gray-800 text-foreground rounded-tl-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-p:my-1 prose-p:leading-relaxed",
              "prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
              "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
              "prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
              "prose-blockquote:border-l-blue-400 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400",
              "prose-strong:font-semibold",
              "prose-code:before:content-none prose-code:after:content-none",
              "prose-code:bg-gray-200 dark:prose-code:bg-gray-700",
              "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-inherit",
              "prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950",
              "prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:my-2",
              "prose-pre:p-4 prose-pre:text-xs",
              "prose-table:text-xs prose-table:border-collapse",
              "prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:px-2 prose-th:py-1 prose-th:bg-gray-200 dark:prose-th:bg-gray-700",
              "prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-2 prose-td:py-1",
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre({ children }) {
                  return (
                    <pre className="bg-gray-900 dark:bg-gray-950 rounded-xl overflow-x-auto p-4 text-xs leading-5 my-2">
                      {children}
                    </pre>
                  );
                },
                code({ className, children, ...props }) {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) {
                    return (
                      <code
                        className={cn(className, "text-xs font-mono")}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono"
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
