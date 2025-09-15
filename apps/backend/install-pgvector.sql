-- pgvector 확장 설치
CREATE EXTENSION IF NOT EXISTS vector;

-- 벡터 인덱스 생성 (성능 최적화)
-- 코사인 유사도 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS messages_embedding_cosine_idx 
ON "Message" USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- HNSW 인덱스 (더 빠른 검색, PostgreSQL 12+)
-- CREATE INDEX IF NOT EXISTS messages_embedding_hnsw_idx 
-- ON "Message" USING hnsw (embedding vector_cosine_ops) 
-- WITH (m = 16, ef_construction = 64);

-- 임베딩이 있는 메시지 수 확인
SELECT COUNT(*) as total_messages, 
       COUNT(embedding) as messages_with_embeddings 
FROM "Message";
