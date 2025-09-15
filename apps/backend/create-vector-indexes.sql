-- 벡터 인덱스 생성 스크립트
-- 성능 최적화를 위한 pgvector 인덱스들

-- 1. 코사인 유사도 검색을 위한 IVFFlat 인덱스
-- 빠른 근사 검색에 적합
CREATE INDEX IF NOT EXISTS messages_embedding_cosine_idx 
ON messages USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 2. L2 거리 검색을 위한 IVFFlat 인덱스
-- 유클리드 거리 기반 검색에 적합
CREATE INDEX IF NOT EXISTS messages_embedding_l2_idx 
ON messages USING ivfflat (embedding vector_l2_ops) 
WITH (lists = 100);

-- 3. 내적 검색을 위한 IVFFlat 인덱스
-- 내적 기반 검색에 적합
CREATE INDEX IF NOT EXISTS messages_embedding_ip_idx 
ON messages USING ivfflat (embedding vector_ip_ops) 
WITH (lists = 100);

-- 4. 복합 인덱스 (roomId + embedding)
-- 특정 채팅방 내에서의 벡터 검색 최적화
CREATE INDEX IF NOT EXISTS messages_room_embedding_idx 
ON messages (room_id) 
WHERE embedding IS NOT NULL;

-- 5. 메시지 역할별 인덱스
-- 사용자 메시지와 어시스턴트 메시지 구분 검색
CREATE INDEX IF NOT EXISTS messages_role_embedding_idx 
ON messages (role) 
WHERE embedding IS NOT NULL;

-- 인덱스 생성 완료 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'messages' 
AND indexdef LIKE '%vector%'
ORDER BY indexname;
