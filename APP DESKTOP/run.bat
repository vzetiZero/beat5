@echo off
REM Run Beat5 Desktop App
REM Được sử dụng sau khi setup.bat

setlocal enabledelayedexpansion

if not exist "venv" (
    echo [ERROR] Virtual environment chưa được tạo
    echo Vui lòng chạy: setup.bat
    pause
    exit /b 1
)

echo [INFO] Kích hoạt virtual environment...
call venv\Scripts\activate.bat

echo [INFO] Khởi động ứng dụng Beat5 Desktop App...
python main.py

pause
