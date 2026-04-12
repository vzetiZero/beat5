# Beat5 Desktop Application

Ứng dụng quản lý dữ liệu Desktop cho dự án Beat5 - Quản Lý Web Cam Đo

## Tính năng

### 📊 Quản lý Cửa hàng
- Xem danh sách các cửa hàng
- Tìm kiếm cửa hàng theo tên, địa chỉ, SĐT
- Xem chi tiết cửa hàng
- Thêm/Sửa/Xóa cửa hàng

### 👥 Quản lý Nhân viên
- Xem danh sách nhân viên
- Tìm kiếm nhân viên theo tên, username, email
- Xem chi tiết nhân viên
- Quản lý phân quyền

### 💳 Quản lý Trả góp
- Xem danh sách hợp đồng trả góp
- Tìm kiếm hợp đồng theo cửa hàng, tên thợ lắp
- Lọc theo trạng thái thanh toán
- Cập nhật tiến độ thanh toán

## Cài đặt

### 1. Yêu cầu hệ thống
- Python 3.8+
- Windows/Mac/Linux

### 2. Cài đặt dependencies
```bash
pip install -r requirements.txt
```

### 3. Chạy ứng dụng
```bash
python main.py
```

## Cấu trúc dự án

```
App Desktop/
├── main.py              # Entry point - Điểm vào ứng dụng
├── config.py            # Configuration - Cấu hình
├── database.py          # Database connections and queries
├── requirements.txt     # Python dependencies
└── README.md           # Documentation
```

## Ghi chú

- Ứng dụng sử dụng PyQt6 để tạo giao diện
- Kết nối trực tiếp với SQLite database của web project
- Dữ liệu được lấy real-time từ database

## Phát triển tiếp

### TODO - Tính năng sắp tới:
- [ ] Thêm modal dialog để tạo/sửa cửa hàng
- [ ] Thêm modal dialog để tạo/sửa nhân viên
- [ ] Export dữ liệu ra Excel
- [ ] Import dữ liệu từ Excel
- [ ] Thêm biểu đồ thống kê
- [ ] Phân trang cho bảng dữ liệu lớn
- [ ] Cài đặt ứng dụng (theme, ngôn ngữ, etc.)
- [ ] Sync dữ liệu với web server

## Liên hệ

Liên hệ hỗ trợ qua email hoặc GitHub Issues
