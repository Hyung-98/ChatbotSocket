#!/bin/bash

# Docker 이미지 빌드 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
VERSION=${VERSION:-"latest"}
PROJECT_NAME="chatbot"

echo -e "${BLUE}🐳 Building Docker images for ${PROJECT_NAME}${NC}"
echo -e "${YELLOW}Registry: ${REGISTRY}${NC}"
echo -e "${YELLOW}Version: ${VERSION}${NC}"

# 백엔드 이미지 빌드
echo -e "${BLUE}📦 Building backend image...${NC}"
docker build -t ${REGISTRY}/${PROJECT_NAME}-backend:${VERSION} -f apps/backend/Dockerfile apps/backend/

# 프론트엔드 이미지 빌드
echo -e "${BLUE}📦 Building frontend image...${NC}"
docker build -t ${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION} -f apps/frontend/Dockerfile apps/frontend/

# 이미지 태그 추가 (latest)
echo -e "${BLUE}🏷️  Tagging images as latest...${NC}"
docker tag ${REGISTRY}/${PROJECT_NAME}-backend:${VERSION} ${REGISTRY}/${PROJECT_NAME}-backend:latest
docker tag ${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION} ${REGISTRY}/${PROJECT_NAME}-frontend:latest

echo -e "${GREEN}✅ Docker images built successfully!${NC}"
echo -e "${YELLOW}Images:${NC}"
echo "  - ${REGISTRY}/${PROJECT_NAME}-backend:${VERSION}"
echo "  - ${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION}"
echo "  - ${REGISTRY}/${PROJECT_NAME}-backend:latest"
echo "  - ${REGISTRY}/${PROJECT_NAME}-frontend:latest"

# 이미지 푸시 (선택사항)
if [ "$PUSH_IMAGES" = "true" ]; then
    echo -e "${BLUE}📤 Pushing images to registry...${NC}"
    docker push ${REGISTRY}/${PROJECT_NAME}-backend:${VERSION}
    docker push ${REGISTRY}/${PROJECT_NAME}-frontend:${VERSION}
    docker push ${REGISTRY}/${PROJECT_NAME}-backend:latest
    docker push ${REGISTRY}/${PROJECT_NAME}-frontend:latest
    echo -e "${GREEN}✅ Images pushed successfully!${NC}"
fi
