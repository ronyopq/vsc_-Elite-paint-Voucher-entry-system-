@echo off
REM Development Setup Script for Windows
REM Run this to set up local development environment

echo.
echo ============================================
echo   Elite Paint Voucher - Development Setup
echo ============================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK Node.js version: %NODE_VERSION%

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (    
    echo Error: npm is not installed
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo OK npm version: %NPM_VERSION%

REM Install dependencies
echo.
echo [*] Installing dependencies...
call npm install

REM Install wrangler globally
echo.
echo [*] Installing Wrangler...
call npm install -g wrangler

REM Create .env.local if not exists
if not exist .env.local (
    echo.
    echo [*] Creating .env.local...
    copy .env.example .env.local
    echo Warning: Please update .env.local with your configuration
)

REM Create .wrangler if not exists
if not exist .wrangler (
    echo.
    echo [*] Creating .wrangler directory...
    mkdir .wrangler
)

echo.
echo OK Setup complete!
echo.
echo Next steps:
echo 1. Update .env.local with your Google OAuth credentials
echo 2. Run: wrangler login
echo 3. Create D1 database: wrangler d1 create elite-voucher
echo 4. Start development: npm run dev
echo.
echo Ready to start developing!
echo.
pause
