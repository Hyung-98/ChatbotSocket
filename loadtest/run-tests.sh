#!/bin/bash

# 부하 테스트 실행 스크립트

echo "🚀 Starting Load Tests..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# k6 설치 확인
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed. Please install k6 first.${NC}"
    echo "Installation guide: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# 백엔드 서버 상태 확인
echo -e "${BLUE}🔍 Checking backend server status...${NC}"
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${RED}❌ Backend server is not running on localhost:3000${NC}"
    echo "Please start the backend server first:"
    echo "  cd apps/backend && pnpm run start:dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend server is running${NC}"

# 결과 디렉토리 생성
mkdir -p results
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}📊 Running API Load Test...${NC}"
k6 run --out json=results/api-test-${TIMESTAMP}.json api-test.js

echo -e "${BLUE}📊 Running WebSocket Load Test...${NC}"
k6 run --out json=results/socket-test-${TIMESTAMP}.json socket-test.js

echo -e "${GREEN}✅ Load tests completed!${NC}"
echo -e "${YELLOW}📁 Results saved in: results/${NC}"
echo -e "${YELLOW}📊 HTML reports generated:${NC}"
echo "  - results/api-loadtest-summary.html"
echo "  - results/loadtest-summary.html"
