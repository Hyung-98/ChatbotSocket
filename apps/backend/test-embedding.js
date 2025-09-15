const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/chatbot_socket?schema=public',
    },
  },
});

async function testEmbeddingSearch() {
  try {
    console.log('🔍 Testing embedding search functionality...\n');

    // 1. 임베딩이 있는 메시지 수 확인
    const totalMessages = await prisma.message.count();
    const messagesWithEmbeddings = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM messages WHERE embedding IS NOT NULL
    `;

    console.log(`📊 Database Status:`);
    console.log(`   Total messages: ${totalMessages}`);
    console.log(
      `   Messages with embeddings: ${messagesWithEmbeddings[0].count}`,
    );

    // 2. 임베딩이 없는 메시지들 확인
    const messagesWithoutEmbeddings = await prisma.$queryRaw`
      SELECT id, content, role, "createdAt"
      FROM messages 
      WHERE embedding IS NULL 
      AND content IS NOT NULL 
      AND content != ''
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;

    console.log(`\n📝 Messages without embeddings (sample):`);
    messagesWithoutEmbeddings.forEach((msg, index) => {
      console.log(
        `   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`,
      );
    });

    // 3. pgvector 확장 확인
    const vectorExtension = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as exists
    `;

    console.log(
      `\n🔧 pgvector extension installed: ${vectorExtension[0].exists}`,
    );

    // 4. 벡터 인덱스 확인
    const vectorIndexes = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'messages' 
      AND indexdef LIKE '%vector%'
    `;

    console.log(`\n📈 Vector indexes:`);
    vectorIndexes.forEach((idx, index) => {
      console.log(`   ${index + 1}. ${idx.indexname}`);
    });

    console.log('\n✅ Embedding search test completed!');
  } catch (error) {
    console.error('❌ Error testing embedding search:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmbeddingSearch();
