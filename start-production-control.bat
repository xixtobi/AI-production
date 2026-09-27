@echo off
setlocal enabledelayedexpansion

title Local Production Control v1.0.0
cls

echo ==============================================================
echo   LOCAL PRODUCTION CONTROL - v1.0.0 RELEASE
echo   Sistem Kontrol Produksi Animasi ^& Video AI Lokal
echo   Bind: 127.0.0.1:3000 (Pribadi ^& Aman)
echo ==============================================================
echo.

:: 1. Check Node.js
echo [1/5] Memeriksa instalasi Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan di PATH sistem Anda!
    echo Silakan unduh dan instal Node.js v20+ dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo       Node.js terdeteksi: !NODE_VERSION!

:: 2. Check npm
echo [2/5] Memeriksa npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm tidak ditemukan di PATH!
    pause
    exit /b 1
)

:: 3. Check environment
echo [3/5] Memeriksa berkas konfigurasi .env.local...
if not exist ".env.local" (
    if not exist ".env" (
        echo [CATATAN] Berkas .env.local belum ditemukan.
        echo          Membuat berkas default .env.local...
        echo # Konfigurasi Local Production Control v1.0.0 > .env.local
        echo GEMINI_API_KEY= >> .env.local
        echo PRODUCTION_CONTROL_DATA_DIR=.local-production-control >> .env.local
        echo [INFO] .env.local berhasil dibuat. Silakan tambahkan GEMINI_API_KEY jika diperlukan.
    )
)

:: 4. Verify Port 3000
echo [4/5] Memeriksa port 127.0.0.1:3000...
netstat -ano | findstr 127.0.0.1:3000 >nul 2>nul
if %errorlevel% equ 0 (
    echo [PERINGATAN] Port 3000 tampaknya sedang digunakan oleh proses lain.
    echo              Aplikasi akan mencoba mengikat atau menampilkan pesan error Next.js.
) else (
    echo       Port 3000 tersedia.
)

:: 5. Launch Browser in background
echo [5/5] Menyiapkan peluncuran peramban...
start "" "http://127.0.0.1:3000"

echo.
echo ==============================================================
echo   Server sedang berjalan di http://127.0.0.1:3000
echo   Tekan Ctrl+C di terminal ini untuk mematikan server.
echo ==============================================================
echo.

:: Start Next.js server bound strictly to localhost 127.0.0.1
call npm run dev -- -H 127.0.0.1 -p 3000

pause
