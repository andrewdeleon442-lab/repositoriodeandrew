@echo off
chcp 65001 >nul
title Instalador FastTrack PRO
color 0A

echo.
echo ===============================================
echo           INSTALADOR FASTTRACK PRO
echo ===============================================
echo.

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js no esta instalado
    echo.
    echo Por favor descarga e instala Node.js desde:
    echo    https://nodejs.org/
    echo.
    echo El instalador se cerrara...
    timeout /t 10
    exit /b 1
)

echo Node.js esta instalado
echo.

echo [2/4] Instalando dependencias...
echo Esto puede tomar unos segundos...
echo.
npm install express mysql2 cors body-parser

echo.
echo [3/4] Verificando base de datos...
echo Nota: Asegurate de haber ejecutado fasttrack.sql en phpMyAdmin
echo.

echo [4/4] Iniciando servidor...
echo.
echo ===============================================
echo           INSTALACION COMPLETADA
echo ===============================================
echo.
echo URL PRINCIPAL: http://localhost:3000
echo.
echo PANEL ADMIN:    http://localhost:3000/admin.html
echo PANEL USUARIO:  http://localhost:3000/user.html
echo.
echo IMPORTANTE:
echo    1. Asegurate que XAMPP este ejecutandose
echo    2. En XAMPP: Start Apache y MySQL
echo    3. Ejecuta fasttrack.sql en phpMyAdmin
echo.
echo Para detener el servidor: Presiona Ctrl+C
echo.
echo Iniciando servidor en 5 segundos...
timeout /t 5

node gpsTracker.js
pause