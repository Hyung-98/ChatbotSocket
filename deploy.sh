#!/bin/bash

# 배포 스크립트
set -e

echo "🚀 채팅봇 애플리케이션 배포 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 변수 확인
check_env_vars() {
    log_info "환경 변수 확인 중..."
    
    required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "NEXTAUTH_SECRET"
        "ANTHROPIC_API_KEY"
        "OPENAI_API_KEY"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "다음 환경 변수들이 설정되지 않았습니다:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "env.production.example 파일을 참고하여 .env.production 파일을 생성하세요."
        exit 1
    fi
    
    log_info "환경 변수 확인 완료"
}

# Docker 및 Docker Compose 확인
check_dependencies() {
    log_info "의존성 확인 중..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose가 설치되지 않았습니다."
        exit 1
    fi
    
    log_info "의존성 확인 완료"
}

# 기존 컨테이너 정리
cleanup() {
    log_info "기존 컨테이너 정리 중..."
    
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true
    docker system prune -f || true
    
    log_info "정리 완료"
}

# 이미지 빌드
build_images() {
    log_info "Docker 이미지 빌드 중..."
    
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    log_info "이미지 빌드 완료"
}

# 서비스 시작
start_services() {
    log_info "서비스 시작 중..."
    
    docker-compose -f docker-compose.prod.yml up -d
    
    log_info "서비스 시작 완료"
}

# 헬스체크
health_check() {
    log_info "헬스체크 수행 중..."
    
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "헬스체크 시도 $attempt/$max_attempts"
        
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log_info "헬스체크 성공!"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log_error "헬스체크 실패 - 서비스가 정상적으로 시작되지 않았습니다."
    return 1
}

# 로그 출력
show_logs() {
    log_info "서비스 로그 출력 중..."
    echo ""
    docker-compose -f docker-compose.prod.yml logs --tail=50
}

# 메인 실행
main() {
    log_info "채팅봇 애플리케이션 배포를 시작합니다."
    
    # 환경 변수 파일 로드
    if [ -f .env.production ]; then
        export $(cat .env.production | grep -v '^#' | xargs)
        log_info ".env.production 파일을 로드했습니다."
    else
        log_warn ".env.production 파일이 없습니다. 환경 변수를 직접 설정하세요."
    fi
    
    check_dependencies
    check_env_vars
    cleanup
    build_images
    start_services
    
    if health_check; then
        log_info "🎉 배포가 성공적으로 완료되었습니다!"
        echo ""
        echo "애플리케이션 접속 정보:"
        echo "  - 웹 애플리케이션: http://localhost"
        echo "  - API 서버: http://localhost/api"
        echo "  - 관리자 대시보드: http://localhost/admin"
        echo "  - 모니터링: http://localhost/monitoring"
        echo ""
        echo "관리 명령어:"
        echo "  - 서비스 상태 확인: docker-compose -f docker-compose.prod.yml ps"
        echo "  - 로그 확인: docker-compose -f docker-compose.prod.yml logs -f"
        echo "  - 서비스 중지: docker-compose -f docker-compose.prod.yml down"
        echo ""
    else
        log_error "배포에 실패했습니다."
        show_logs
        exit 1
    fi
}

# 스크립트 실행
main "$@"
