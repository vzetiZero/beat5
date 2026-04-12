@echo off
REM Setup script for Beat5 Desktop App
REM Yêu cầu: Python 3.8+

echo.
echo =====================================
echo Beat5 Desktop App - Setup Script
echo =====================================
echo.

REM Check Python installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python không được cài đặt!
    echo Vui lòng cài đặt Python 3.8+ từ https://www.python.org
    pause
    exit /b 1
)

REM Show Python version
echo [INFO] Python version:
python --version
echo.

REM Create virtual environment
echo [INFO] Tạo virtual environment...
python -m venv venv
if %errorlevel% neq 0 (
    echo [ERROR] Không thể tạo virtual environment
    pause
    exit /b 1
)

REM Activate virtual environment
echo [INFO] Kích hoạt virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [INFO] Cài đặt dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Không thể cài đặt dependencies
    pause
    exit /b 1
)

echo.
echo =====================================
echo [SUCCESS] Setup hoàn tất!
echo =====================================
echo.
echo Để chạy ứng dụng:
echo   1. run.bat
echo    hoặc
echo   2. python main.py
echo.
pause
