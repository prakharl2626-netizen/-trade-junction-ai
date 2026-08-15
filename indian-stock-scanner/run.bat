@echo off
title Trade Junction AI - Indian Stock Market Terminal
echo =======================================================
echo    Trade Junction AI - Live NSE/BSE Trading Terminal
echo =======================================================
echo.
echo [1/2] Starting Python Live Backend Server on Port 8080...
start "" http://localhost:8080
python server.py
pause
