import { prisma } from "@/lib/prisma";
import { anthropic, CLAUDE_MODEL, DEFAULT_MAX_TOKENS } from "@/lib/anthropic";
import { gemini, GEMINI_MODEL } from "@/lib/google";
import type { ChatMessage, StreamResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let conversationId: string;
  let message: string;

  try {
    const body = await request.json();
    conversationId = body.conversationId;
    message = body.message;

    if (!conversationId || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId or message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const wasEmpty = conversation.messages.length === 0;

  await prisma.message.create({
    data: { conversationId, role: "USER", content: message.trim() },
  });

  const chatHistory: ChatMessage[] = conversation.messages.map((m: any) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
  chatHistory.push({ role: "user", content: message.trim() });

  const encode = (obj: StreamResponse) =>
    new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";

      try {
        // Anthropic API 사용 예시 (주석 처리됨)
        // const claudeStream = anthropic.messages.stream({
        //   model: CLAUDE_MODEL,
        //   max_tokens: DEFAULT_MAX_TOKENS,
        //   ...(conversation.systemPrompt
        //     ? { system: conversation.systemPrompt }
        //     : {}),
        //   messages: chatHistory,
        // });

        // for await (const chunk of claudeStream) {
        //   if (
        //     chunk.type === "content_block_delta" &&
        //     chunk.delta.type === "text_delta"
        //   ) {
        //     fullContent += chunk.delta.text;
        //     controller.enqueue(
        //       encode({ type: "content", content: chunk.delta.text }),
        //     );
        //   }
        // }

        // Prisma에서 가져온 대화 기록을 Gemini API에 맞는 형식으로 변환
        const geminiHistory = chatHistory.slice(0, -1).map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));

        const chat = gemini.chats.create({
          model: GEMINI_MODEL,
          config: {
            ...(conversation.systemPrompt
              ? { systemInstruction: conversation.systemPrompt }
              : {}),
          },
          history: geminiHistory,
        });

        const geminiResponse = await chat.sendMessageStream({
          message: message.trim(),
        });

        for await (const chunk of geminiResponse) {
          const text = chunk.text;
          if (text) {
            fullContent += text;
            controller.enqueue(encode({ type: "content", content: text }));
          }
        }

        await prisma.message.create({
          data: { conversationId, role: "ASSISTANT", content: fullContent },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        if (wasEmpty && fullContent) {
          generateTitle(conversationId, message.trim()).catch(console.error);
        }

        controller.enqueue(encode({ type: "done", conversationId }));
        controller.close();
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Streaming error";
        console.error("Chat stream error:", error);
        controller.enqueue(encode({ type: "error", error: errMsg }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function generateTitle(conversationId: string, firstMessage: string) {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `다음 메시지를 보고 대화 제목을 한국어로 20자 이내로 만들어줘. 제목만 출력하고 다른 설명은 하지 마.\n\n메시지: ${firstMessage}`,
      },
    ],
  });

  const title =
    response.content[0]?.type === "text"
      ? response.content[0].text.trim().slice(0, 20)
      : "새 대화";

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });
}
