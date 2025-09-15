@echo off
REM Kubernetes 배포 스크립트 (Windows)

echo 🚀 Deploying Chatbot to Kubernetes
echo Namespace: chatbot

REM kubectl 설치 확인
kubectl version --client >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ kubectl is not installed. Please install kubectl first.
    echo Installation guide: https://kubernetes.io/docs/tasks/tools/
    pause
    exit /b 1
)

REM 클러스터 연결 확인
echo 🔍 Checking cluster connection...
kubectl cluster-info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Cannot connect to Kubernetes cluster
    echo Please check your kubeconfig and cluster connection
    pause
    exit /b 1
)
echo ✅ Connected to cluster

REM 네임스페이스 생성
echo 📦 Creating namespace...
kubectl apply -f kubernetes/namespace.yaml

REM 시크릿 생성
echo 🔐 Creating secrets...
kubectl apply -f kubernetes/secrets.yaml

REM 데이터베이스 배포
echo 🗄️ Deploying PostgreSQL...
kubectl apply -f kubernetes/postgres-deployment.yaml

REM Redis 배포
echo 🔴 Deploying Redis...
kubectl apply -f kubernetes/redis-deployment.yaml

REM 백엔드 배포
echo ⚙️ Deploying Backend...
kubectl apply -f kubernetes/backend-deployment.yaml

REM 프론트엔드 배포
echo 🎨 Deploying Frontend...
kubectl apply -f kubernetes/frontend-deployment.yaml

REM Ingress 배포
echo 🌐 Deploying Ingress...
kubectl apply -f kubernetes/ingress.yaml

REM 배포 상태 확인
echo 📊 Checking deployment status...
kubectl get pods -n chatbot
kubectl get services -n chatbot
kubectl get ingress -n chatbot

echo ✅ Deployment completed!
echo To access the application:
echo 1. Add '127.0.0.1 chatbot.local' to your hosts file
echo 2. Visit http://chatbot.local in your browser
echo.
echo To check logs:
echo kubectl logs -f deployment/chatbot-backend -n chatbot
echo kubectl logs -f deployment/chatbot-frontend -n chatbot

pause
