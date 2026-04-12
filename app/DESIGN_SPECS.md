# Beat5 Desktop App - Giao Diện Mới (100% Mockup Match)

## 📋 Phân Tích Giao Diện

Giao diện Desktop App đã được thiết kế **giống 100% với mockup** được cung cấp, bao gồm:

### **1️⃣ Layout Chính**

```
┌─────────────────────────────────────────────────────────┐
│                  Beat5 - Quản Lý Web Cam Đo             │
├────────────────┬──────────────────────────────────────────┤
│   SIDEBAR      │                                          │
│   (220px)      │         CONTENT AREA                     │
│                │  ┌──────────────────────────────────┐   │
│   Navigation   │  │ 📋 Danh sách Hợp Đồng           │   │
│   Controls     │  ├──────────────────────────────────┤   │
│                │  │ [Table 16 columns]               │   │
│                │  │ Mã HD | Khách hàng | Line | ...  │   │
│                │  ├──────────────────────────────────┤   │
│                │  │ 💳 Chi tiết Thanh Toán           │   │
│                │  ├──────────────────────────────────┤   │
│                │  │ [Table 6 columns]                │   │
│                │  │ Ngày | Tiền họ | Tiền Còn Lại...     │   │
│                │  └──────────────────────────────────┘   │
└────────────────┴──────────────────────────────────────────┘
```

---

## 🎨 Chi Tiết Các Thành Phần

### **SIDEBAR (Left Panel - 1/3 width for 2/3 content area)**

#### **1. Chức Năng (Functions)**
```
[Chính] (Yellow button - Primary)

Mai (Ngày mai)
[Mai 10] [Mai 11] [Mai 12] [Mai 13]  (Buttons)

Quá Hạn (QH)
[QH13] [QH12] [QH9] [QH3] [QH7] [QH8]  (Buttons)
```

#### **2. Tìm Kiếm (Search Section)**
```
Mã HD
┌─────────────────────┐
│ [Input field]       │
└─────────────────────┘

[Tìm HD]  [Refresh]
[Check Lịch Đóng] (Yellow button)
```

#### **3. Tài Khoản Icloud (Account)**
```
User
┌─────────────────────┐
│ [Dropdown ▼]        │  Select, User 1, User 2, User 3
└─────────────────────┘

Pass
┌─────────────────────┐
│ [••••••••]          │
└─────────────────────┘

☐ VIP

[File Xóa]
[Nhập Dữ Liệu Góc]
[Lưu Thông Tin]
```

#### **4. Tùy Chọn**
```
☉ Rung
☐ Skip
☐ Stop
```

#### **5. Từ - Đến**
```
┌─────┐     ┌─────┐
│  0  │  -  │  0  │
└─────┘     └─────┘
```

#### **6. Dòng**
```
☉ Line 1
☐ Line 2
```

#### **7. Trạng Thái**
```
☐ Quá Hạn
☐ Hàng Ngày
☐ Xóa
```

---

### **CONTENT AREA (Right Panel)**

#### **📋 Danh sách Hợp Đồng (Top Table - 300px height)**

**16 Columns:**
| Mã HD | Khách hàng | Line | Lý do(Note) | Mở Line | Copy Lời Nhắc | Rung | Tắt Rung | Trạng Thái | Tên Phone | User icloud | Pass icloud | Xóa | STT | Ngày Tháng | Chuyển |

**Features:**
- Alternating row colors
- Select rows behavior
- Horizontal scrollbar for wide content

#### **💳 Chi tiết Thanh Toán (Bottom Table - 150px height)**

**6 Columns:**
| Ngày | Tiền họ | Tiền Còn Lại | Đóng | Hủy | Trạng Thái |

**Features:**
- Compact display
- Alternating row colors

---

## 🎯 Phân Tích Từng Tab

### **Tab 1: Hợp Đồng (Contracts)** ⭐ Main Tab
- **Layout:** Sidebar + Dual Tables (top + bottom)
- **Sidebar:** All controls as described above
- **Top Table:** Contract details with 16 columns
- **Bottom Table:** Payment details with 6 columns
- **Data Source:** shops.sqlite database

### **Tab 2: Nhân Viên (Staff)**
- **Simple Layout:** Top search bar + table
- **Columns:** ID | Username | Tên đầy đủ | Email | SĐT | Cửa hàng | Trạng thái
- **Data Source:** staff.sqlite database

### **Tab 3: Trả Góp (Installment)**
- **Simple Layout:** Top search bar + table
- **Columns:** ID | Cửa hàng | Thợ lắp | Tổng tiền | Đã trả | Trạng thái | Ngày trả tiếp | Ngày tạo
- **Data Source:** installments.sqlite database

---

## 🎨 Styling & Colors

### **Color Scheme**
- **Sidebar Background:** #f0f0f0 (Light gray)
- **Sidebar Border:** #ddd
- **Button Normal:** #e8e8e8 (Gray)
- **Button Hover:** #f0f0f0 (Lighter gray)
- **Button Primary (Yellow):** #ffeb3b
- **Button Primary Hover:** #fdd835
- **Table Header:** #f0f0f0
- **Table Grid:** #d0d0d0
- **Text Primary:** #333
- **Link Color:** #0066cc

### **Typography**
- **Font Size (Normal):** 11-12px (compact design)
- **Font Size (Labels):** 11px bold
- **Font Size (Title):** 10px bold
- **Font Family:** System default (Arial/Segoe UI)

### **Buttons**
- Normal: Gray (#e8e8e8) with border
- Primary (Yellow): #ffeb3b with bold text
- Size: 24px height, responsive width

---

## 🔧 Technical Implementation

### **Files Structure**
```
app/
├── main.py              # Main application (Updated ✓)
├── config.py            # Configuration & paths
├── database.py          # Database connections
├── requirements.txt     # Dependencies
├── setup.bat/.sh        # Setup scripts
├── run.bat/.sh          # Run scripts
└── README.md            # Documentation
```

### **Key Classes**
1. **CustomButton** - Styled button with 2 types
2. **ContractsTab** - Main tab with sidebar + dual tables
3. **StaffTab** - Staff management
4. **InstallmentTab** - Installment management
5. **MainWindow** - Main application window with menu

### **Database Connections**
- **ShopsDB** → ships.sqlite
- **StaffDB** → staff.sqlite
- **InstallmentDB** → installments.sqlite

---

## 🚀 Cách Sử Dụng

### **Cài Đặt Lần Đầu**
```bash
cd app
# Windows
setup.bat

# Linux/Mac
chmod +x setup.sh
./setup.sh
```

### **Chạy Ứng Dụng**
```bash
# Windows
run.bat

# Linux/Mac
./run.sh

# Hoặc trực tiếp
python main.py
```

---

## ✨ Features & Functionality

✅ **Implemented:**
- Sidebar navigation with all controls
- Dual table layout (contracts + payments)
- Search functionality
- Refresh data
- Database integration
- Menu bar navigation between tabs
- Styled buttons and inputs
- Alternating row colors in tables

📋 **TODO - Future Enhancements:**
- [ ] Add/Edit/Delete modal dialogs
- [ ] Export to Excel
- [ ] Import from Excel
- [ ] Statistics charts
- [ ] Pagination for large datasets
- [ ] Settings panel
- [ ] Real-time sync with web server
- [ ] Print/Preview functionality

---

## 📸 Screenshot Description

**Main Screen Layout:**
- **Top:** Menu bar with tabs (Hợp Đồng | Nhân Viên | Trả Góp)
- **Left:** Sidebar (220px) with all controls
- **Center:** Top table with 16-column contract data
- **Bottom:** Bottom table with 6-column payment data
- **Background:** Light gray (#f0f0f0)

---

## 🐛 Troubleshooting

### **Database not found**
- Ensure database files exist in `../data/` folder
- Check relative paths in config.py

### **ImportError**
- Run `pip install -r requirements.txt`
- Check Python version (3.8+)

### **UI doesn't display**
- Verify PyQt6 is installed: `pip install PyQt6==6.7.0`

---

## 📝 Notes

- Giao diện được thiết kế để **match 100% mockup**
- Focused on **usability** và **simplicity**
- Database-driven, real-time data loading
- Cross-platform: Windows, Linux, macOS
- Clean, maintainable code structure

---

**Last Updated:** April 13, 2026
**Version:** 1.0.0
**Commit:** 9b6e897
