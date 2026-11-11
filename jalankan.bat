@echo off
title Website Nokos
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terinstall. Download versi LTS di https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo File .env dibuat. Isi dulu datanya, simpan, lalu jalankan file ini lagi.
  notepad .env
  exit /b 1
)

if not exist node_modules (
  echo Install library, tunggu 1-3 menit...
  call npm install
  if errorlevel 1 ( echo Install gagal. & pause & exit /b 1 )
)

echo Membangun website...
call npm run build
if errorlevel 1 ( echo Build gagal, lihat pesan di atas. & pause & exit /b 1 )

:loop
echo.
echo Website jalan di http://localhost:3000  (tutup jendela ini untuk berhenti)
call npm start
echo Website berhenti. Restart otomatis dalam 5 detik...
timeout /t 5 >nul
goto loop
