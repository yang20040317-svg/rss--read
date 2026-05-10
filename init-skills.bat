@echo off
setlocal enabledelayedexpansion

echo ======================================================
echo   ⚙️  AI Superpowers-ZH 快速挂载脚本 (v1.0)
echo ======================================================
echo.
echo [当前目录]: %CD%

:: 设定源路径 (技能库根目录)
set "SKILLS_ROOT=D:\siklls"
set "SOURCE_DIR=%SKILLS_ROOT%\superpowers-zh"

:: 检查源目录是否存在
if not exist "%SOURCE_DIR%" (
    echo [错误] 未能找到技能源目录: %SOURCE_DIR%
    echo 请确保 superpowers-zh 已安装在 D:\siklls 下。
    pause
    exit /b
)

:: 目标配置目录
set "ANTIGRAVITY_DIR=%CD%\.antigravity"
set "TARGET_SKILLS=%ANTIGRAVITY_DIR%\skills"

:: 创建必要目录
if not exist "%TARGET_SKILLS%" (
    echo [正在创建] 技能挂载点: %TARGET_SKILLS%
    mkdir "%TARGET_SKILLS%"
)

:: 同步技能文件
echo [正在同步] 核心能力库...
xcopy /s /y /i "%SOURCE_DIR%\*" "%TARGET_SKILLS%" > nul

:: 写入或更新 rules.md
set "RULES_FILE=%ANTIGRAVITY_DIR%\rules.md"
echo [正在配置] AI 引导规则...

(
echo # AI Superpowers 核心规则
echo.
echo - **能力挂载**: 当前工作区已挂载专业技能库（位于 .antigravity/skills/）。
echo - **显式触发**: 当任务涉及架构设计、代码审查、文档撰写或系统调试时，优先检索该目录下的 SKILL.md。
echo - **方法论优先**: 遵循技能文件中的「思维方式」和「执行步骤」进行操作。
echo.
echo ^(⚙️ 核心技能列表已同步至工作区^)
) > "%RULES_FILE%"

echo.
echo ======================================================
echo   ✅ 挂载成功！此文件夹已获得 AI 编程超能力。
echo ======================================================
echo.
pause
