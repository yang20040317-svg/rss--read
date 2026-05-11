@echo off
chcp 65001 >nul

:: 检查是否已经通过其他方式启动
if "%1"=="" (
    cmd /k "%~f0" launch
    exit /b
)

if "%1"=="launch" goto :launch

:launch
title RSS 阅读器 - 一键启动

echo ======================================================
echo   📖 RSS 阅读器 - 一键启动
echo ======================================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装
    echo 下载地址: https://www.python.org/
    pause
    exit /b 1
)

:: 获取当前目录
set "PROJECT_DIR=%~dp0"
set "WECHAT_API_DIR=%PROJECT_DIR%backend"

:: ============================================
:: 启动微信后端服务
echo [1/2] 正在启动微信后端服务 (端口 5000)...
echo ============================================
echo.

start "WeChat-API" cmd /k "cd /d %WECHAT_API_DIR% && call start.bat"

:: 等待后端服务启动
echo 等待后端服务启动...
timeout /t 3 /nobreak >nul

:: ============================================
:: 启动前端开发服务器
echo.
echo [2/2] 正在启动前端服务 (端口 3000)...
echo ============================================
echo.

:: 检查依赖
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
)

:: 启动 Vite
cd /d "%PROJECT_DIR%"
npm run dev

pause
