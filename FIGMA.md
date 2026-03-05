# Figma MCP Design System Rules

Generated for: ChatbotSocket (Next.js 14 App Router)

---

## Stack & Styling

| Aspect | Detail |
|--------|--------|
| Framework | React 18 + Next.js 14 App Router |
| Styling | **Tailwind CSS 3.4.12** — utility-first, no CSS Modules |
| Dark Mode | `dark:` prefix via `prefers-color-scheme` media query |
| Class helper | `cn()` = `clsx` + `tailwind-merge` — always use this for conditional classes |
| Typography plugin | `@tailwindcss/typography` — use `prose prose-sm dark:prose-invert` for rich text |

---

## Design Tokens

### Colors (Tailwind classes — no token file)

```
Primary action:   bg-blue-600 / hover:bg-blue-700
User bubble:      bg-blue-600 text-white
AI bubble:        bg-gray-100 dark:bg-gray-800 text-foreground
Borders:          border-gray-200 dark:border-gray-700
Hover states:     hover:bg-gray-100 dark:hover:bg-gray-800
Muted text:       text-gray-500 dark:text-gray-400
Link/accent text: text-blue-600
Focus ring:       focus:ring-2 focus:ring-blue-500
```

CSS variables (defined in `app/globals.css`):
```css
--background: #ffffff  /* dark: #0a0a0a */
--foreground: #171717  /* dark: #ededed */
```
Use as `bg-background`, `text-foreground` in Tailwind.

### Typography

```
Font family: Arial, Helvetica, sans-serif (system font)
text-2xl  — page titles
text-lg   — modal headings
text-sm   — body text, labels, buttons, inputs
text-xs   — code, metadata
font-semibold — headings inside prose
```

### Spacing

```
Padding:  p-2 p-3 p-4 p-6 p-8
X/Y pad:  px-4 py-2.5 (inputs), px-3 py-2 (dense inputs)
Gap:      gap-1 gap-2
```

### Border Radius

```
rounded-xl  — inputs, textareas, buttons (primary)
rounded-2xl — modals, cards
rounded-lg  — secondary buttons, form fields
rounded-tr-sm / rounded-tl-sm — chat bubbles (flat corner on sender side)
```

### Shadows

```
shadow-xl — modal overlays
```

---

## Component Patterns

### File locations

```
components/
  ChatInput.tsx        — auto-expanding textarea + send button
  ChatInterface.tsx    — top-level layout: header + list + input
  ConversationHeader.tsx — dropdown switcher + controls
  LoginForm.tsx        — tabbed login/signup with GitHub OAuth
  MessageBubble.tsx    — user/assistant message with markdown + code highlight
  MessageList.tsx      — scroll container, auto-scrolls to bottom
  Providers.tsx        — NextAuth SessionProvider wrapper
  SystemPromptModal.tsx — full-screen overlay modal
```

### Conditional class pattern

Always use `cn()` from `lib/utils.ts`:

```tsx
import { cn } from '@/lib/utils';

className={cn(
  "flex w-full",
  isUser ? "justify-end" : "justify-start"
)}
```

### Chat bubble pattern

```tsx
// User
"max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-600 text-white"

// Assistant
"max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-foreground"
```

### Input field pattern

```tsx
"w-full rounded-xl border border-gray-300 dark:border-gray-600
 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm
 focus:outline-none focus:ring-2 focus:ring-blue-500"
```

### Button pattern

```tsx
// Primary
"rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"

// Ghost / subtle
"rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
```

### Modal overlay pattern

```tsx
// Backdrop
"fixed inset-0 z-50 flex items-center justify-center bg-black/50"

// Panel
"bg-background rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6"
```

### Dropdown menu pattern

```tsx
"absolute z-10 mt-1 w-72 rounded-xl border border-gray-200 dark:border-gray-700
 bg-white dark:bg-gray-900 shadow-lg overflow-y-auto max-h-80"

// Item
"w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
```

### Markdown prose pattern (MessageBubble)

```tsx
"prose prose-sm dark:prose-invert max-w-none
 prose-p:my-1 prose-p:leading-relaxed
 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
 prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:rounded prose-code:px-1
 prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:p-0
 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
```

---

## Icons

No icon library — two approaches in use:

1. **Emoji** — `⚙️` (settings), `▾` (dropdown chevron)
2. **Inline SVG** — GitHub logo only (in LoginForm), styled with `className="w-4 h-4"` and `fill="currentColor"`

When adding icons from Figma: prefer inline SVG with `fill="currentColor"` so they inherit text color.

---

## Animation / Motion

Defined in `app/globals.css`:

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
.animate-pulse-slow {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

Used as the streaming cursor `▋` in MessageBubble.

---

## Custom Scrollbar

```css
/* globals.css */
::-webkit-scrollbar        { width: 6px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: #888; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #555; }
```

---

## Responsive Design

No mobile-specific breakpoints used yet — layout is flex-based and adapts naturally. If adding responsive variants, follow the existing Tailwind convention (`sm:`, `md:`, `lg:`).

---

## Localization

All UI text is **Korean**. When translating Figma copy:
- Buttons: 전송 (Send), 새 대화 (New), 로그아웃 (Logout), 저장 (Save), 취소 (Cancel)
- Input placeholder: 메시지를 입력하세요...
- Date format: `date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })`

---

## Code Syntax Highlighting

```tsx
// MessageBubble.tsx
import 'highlight.js/styles/github-dark-dimmed.css';
import rehypeHighlight from 'rehype-highlight';

<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
  {content}
</ReactMarkdown>
```

---

## What to Do When Implementing a Figma Design

1. **Check for existing components first** — reuse from `components/`.
2. **Use `cn()` for all conditional classes**, never string concatenation.
3. **No CSS Modules** — Tailwind only; custom CSS only for animations/scrollbars in `globals.css`.
4. **Colors**: prefer Tailwind semantic classes (`bg-blue-600`, `text-gray-500`) over arbitrary values.
5. **Dark mode**: every color must have a `dark:` counterpart.
6. **Borders**: `border border-gray-200 dark:border-gray-700` is the standard.
7. **Text**: `text-sm` is the default body size; increase only for titles.
8. **No image handling** currently in the project — add to `public/` if needed.
