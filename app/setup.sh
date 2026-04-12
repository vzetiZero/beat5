#!/bin/bash
# Setup script for Beat5 Desktop App (Linux/Mac)

echo ""
echo "====================================="
echo "Beat5 Desktop App - Setup Script"
echo "====================================="
echo ""

# Check Python installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 không được cài đặt!"
    echo "Vui lòng cài đặt Python 3.8+ từ https://www.python.org"
    exit 1
fi

# Show Python version
echo "[INFO] Python version:"
python3 --version
echo ""

# Create virtual environment
echo "[INFO] Tạo virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "[ERROR] Không thể tạo virtual environment"
    exit 1
fi

# Activate virtual environment
echo "[INFO] Kích hoạt virtual environment..."
source venv/bin/activate

# Install dependencies
echo "[INFO] Cài đặt dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Không thể cài đặt dependencies"
    exit 1
fi

echo ""
echo "====================================="
echo "[SUCCESS] Setup hoàn tất!"
echo "====================================="
echo ""
echo "Để chạy ứng dụng:"
echo "  1. ./run.sh"
echo "    hoặc"
echo "  2. python main.py"
echo ""
