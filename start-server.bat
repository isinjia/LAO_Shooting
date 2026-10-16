@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM 이 배치 파일이 있는 폴더로 이동 (어디서 실행해도 동작)
cd /d "%~dp0"

set "PORT=5173"
set "URL=http://localhost:%PORT%/"

echo.
echo ========================================
echo   LAO MINI ACTION - 미리보기 서버
echo ========================================
echo   폴더: %CD%
echo   주소: %URL%
echo ----------------------------------------
echo.

REM 포트가 이미 사용 중이면 서버를 다시 띄우지 않음
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [안내] 포트 %PORT% 가 이미 사용 중입니다.
  echo        기존 서버를 그대로 사용합니다.
  echo.
  echo 브라우저를 엽니다: %URL%
  start "" "%URL%"
  echo.
  echo 이 창은 닫아도 됩니다.
  echo.
  pause
  exit /b 0
)

echo [시작] 서버를 켭니다... (이 창을 닫으면 서버가 종료됩니다)
echo        명령: npx --yes serve -l %PORT% .
echo.

REM 잠시 후 브라우저 자동 실행 (백그라운드)
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start %URL%"

npx --yes serve -l %PORT% .

echo.
echo [종료] 서버가 멈췄습니다.
pause
endlocal
