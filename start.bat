@echo off
chcp 65001 >nul
title Family Accounting Launcher
cd /d "%~dp0"

echo ========================================
echo   Family Accounting - 一键启动
echo ========================================
echo.

set "HAVE_BACKEND=0"
set "HAVE_FRONTEND=0"

REM 检查端口是否已被占用
netstat -ano | findstr ":5000 " >nul 2>&1
if %errorlevel% equ 0 set "HAVE_BACKEND=1"
netstat -ano | findstr ":5174 " >nul 2>&1
if %errorlevel% equ 0 set "HAVE_FRONTEND=1"

if %HAVE_BACKEND% equ 1 (
    echo [!] 后端 (Flask :5000) 已在运行
) else (
    echo [1/2] 启动后端 (Flask :5000)...
    start "Family-Backend" cmd /c "cd /d "%~dp0backend" && python app.py"
)

if %HAVE_FRONTEND% equ 1 (
    echo [!] 前端 (Vite :5174) 已在运行
) else (
    echo [2/2] 启动前端 (Vite :5174)...
    start "Family-Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"
)

echo.
echo [✓] 服务启动完成！
echo.
echo   后端 ^> http://localhost:5000
echo   前端 ^> http://localhost:5174
echo.
if %HAVE_BACKEND% equ 1 if %HAVE_FRONTEND% equ 1 (
    echo   (两个服务都已存在，未启动新进程)
)
if %HAVE_BACKEND% equ 0 if %HAVE_FRONTEND% equ 0 (
    echo   关闭对应窗口即可停止服务
)
echo.
pause
