@echo off
REM 부하 테스트 실행 스크립트 (Windows)

echo 🚀 Starting Load Tests...

REM k6 설치 확인
k6 version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ k6 is not installed. Please install k6 first.
    echo Installation guide: https://k6.io/docs/getting-started/installation/
    pause
    exit /b 1
)

REM 백엔드 서버 상태 확인
echo 🔍 Checking backend server status...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Backend server is not running on localhost:3000
    echo Please start the backend server first:
    echo   cd apps/backend ^&^& pnpm run start:dev
    pause
    exit /b 1
)
echo ✅ Backend server is running

REM 결과 디렉토리 생성
if not exist results mkdir results
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "TIMESTAMP=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"

echo 📊 Running API Load Test...
k6 run --out json=results/api-test-%TIMESTAMP%.json api-test.js

echo 📊 Running WebSocket Load Test...
k6 run --out json=results/socket-test-%TIMESTAMP%.json socket-test.js

echo ✅ Load tests completed!
echo 📁 Results saved in: results\
echo 📊 HTML reports generated:
echo   - results/api-loadtest-summary.html
echo   - results/loadtest-summary.html

pause
