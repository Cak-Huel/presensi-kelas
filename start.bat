@echo off
title Sistem Absensi Kelas
echo ==========================================
echo   Sistem Absensi Kelas - Local Server
echo ==========================================
echo.
echo Memulai server di http://localhost:8080
echo Tekan Ctrl+C untuk menghentikan server.
echo.
npx -y http-server . -p 8080 -o -c-1
pause
