#!/bin/bash

# Kubernetes 배포 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
NAMESPACE="chatbot"
KUBECONFIG=${KUBECONFIG:-"~/.kube/config"}

echo -e "${BLUE}🚀 Deploying Chatbot to Kubernetes${NC}"
echo -e "${YELLOW}Namespace: ${NAMESPACE}${NC}"
echo -e "${YELLOW}Kubeconfig: ${KUBECONFIG}${NC}"

# kubectl 설치 확인
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed. Please install kubectl first.${NC}"
    echo "Installation guide: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# 클러스터 연결 확인
echo -e "${BLUE}🔍 Checking cluster connection...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
    echo "Please check your kubeconfig and cluster connection"
    exit 1
fi
echo -e "${GREEN}✅ Connected to cluster${NC}"

# 네임스페이스 생성
echo -e "${BLUE}📦 Creating namespace...${NC}"
kubectl apply -f kubernetes/namespace.yaml

# 시크릿 생성
echo -e "${BLUE}🔐 Creating secrets...${NC}"
kubectl apply -f kubernetes/secrets.yaml

# 데이터베이스 배포
echo -e "${BLUE}🗄️ Deploying PostgreSQL...${NC}"
kubectl apply -f kubernetes/postgres-deployment.yaml

# Redis 배포
echo -e "${BLUE}🔴 Deploying Redis...${NC}"
kubectl apply -f kubernetes/redis-deployment.yaml

# 백엔드 배포
echo -e "${BLUE}⚙️ Deploying Backend...${NC}"
kubectl apply -f kubernetes/backend-deployment.yaml

# 프론트엔드 배포
echo -e "${BLUE}🎨 Deploying Frontend...${NC}"
kubectl apply -f kubernetes/frontend-deployment.yaml

# Ingress 배포
echo -e "${BLUE}🌐 Deploying Ingress...${NC}"
kubectl apply -f kubernetes/ingress.yaml

# 배포 상태 확인
echo -e "${BLUE}📊 Checking deployment status...${NC}"
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}
kubectl get ingress -n ${NAMESPACE}

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${YELLOW}To access the application:${NC}"
echo "1. Add '127.0.0.1 chatbot.local' to your /etc/hosts file"
echo "2. Visit http://chatbot.local in your browser"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "kubectl logs -f deployment/chatbot-backend -n ${NAMESPACE}"
echo "kubectl logs -f deployment/chatbot-frontend -n ${NAMESPACE}"