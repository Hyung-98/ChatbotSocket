const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/chatbot_socket?schema=public',
    },
  },
});

async function testEmbeddingGeneration() {
  try {
    console.log('🧪 Testing embedding generation...\n');

    // Mock embedding으로 테스트 (API 키 없이)
    console.log('⚠️  Using mock embedding for testing (no OpenAI API key).');

    // Mock embedding 생성 (1536차원)
    const mockEmbedding = Array.from(
      { length: 1536 },
      () => Math.random() * 2 - 1,
    );

    // 첫 번째 메시지에 mock embedding 저장
    const firstMessage = await prisma.$queryRaw`
      SELECT id, content FROM messages WHERE embedding IS NULL LIMIT 1
    `;

    if (firstMessage.length > 0) {
      const message = firstMessage[0];
      await prisma.$executeRaw`
        UPDATE messages 
        SET embedding = ${JSON.stringify(mockEmbedding)}::vector
        WHERE id = ${message.id}
      `;
      console.log(
        `✅ Mock embedding stored for message: "${message.content.substring(0, 50)}..."`,
      );
    }

    // 임베딩이 있는 메시지 수 확인
    const messagesWithEmbeddings = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM messages WHERE embedding IS NOT NULL
    `;

    console.log(`\n📊 Updated Status:`);
    console.log(
      `   Messages with embeddings: ${messagesWithEmbeddings[0].count}`,
    );

    // 유사도 검색 테스트 (mock embedding 사용)
    if (messagesWithEmbeddings[0].count > 0) {
      console.log('\n🔍 Testing similarity search...');

      // Mock query embedding 생성
      const queryEmbedding = Array.from(
        { length: 1536 },
        () => Math.random() * 2 - 1,
      );

      // 유사도 검색 실행
      const similarMessages = await prisma.$queryRaw`
        SELECT 
          id, 
          content, 
          role, 
          "createdAt",
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM messages
        WHERE embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 3
      `;

      console.log('   Similar messages found:');
      similarMessages.forEach((msg, index) => {
        console.log(
          `   ${index + 1}. [${msg.role}] Similarity: ${msg.similarity.toFixed(4)}`,
        );
        console.log(`      "${msg.content.substring(0, 60)}..."`);
      });
    }

    console.log('\n🎉 Embedding generation test completed!');
  } catch (error) {
    console.error('❌ Error testing embedding generation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmbeddingGeneration();
