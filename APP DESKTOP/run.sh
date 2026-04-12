#!/bin/bash
# Run Beat5 Desktop App (Linux/Mac)

if [ ! -d "venv" ]; then
    echo "[ERROR] Virtual environment chưa được tạo"
    echo "Vui lòng chạy: ./setup.sh"
    exit 1
fi

echo "[INFO] Kích hoạt virtual environment..."
source venv/bin/activate

echo "[INFO] Khởi động ứng dụng Beat5 Desktop App..."
python main.py
