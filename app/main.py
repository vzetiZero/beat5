"""
Beat5 Desktop Application - Main Entry Point
Quản lý Web Cam Đo - Ứng dụng Desktop
Giao diện giống 100% với mockup tương tác
"""
import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QPushButton, QLabel, QLineEdit, QTableWidget, QTableWidgetItem,
    QMessageBox, QHeaderView, QRadioButton, QButtonGroup,
    QComboBox, QCheckBox, QSpinBox
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QColor

try:
    from config import APP_TITLE, APP_VERSION, WINDOW_WIDTH, WINDOW_HEIGHT, TABLE_STYLE
    from database import ShopsDB, StaffDB, InstallmentDB
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)


class CustomButton(QPushButton):
    """Custom button with different styles"""
    def __init__(self, text, style_type="normal"):
        super().__init__(text)
        if style_type == "primary":
            # Yellow button for primary action
            self.setStyleSheet("""
                QPushButton {
                    background-color: #ffeb3b;
                    border: 1px solid #fbc02d;
                    border-radius: 3px;
                    padding: 6px 10px;
                    font-weight: bold;
                    color: #000;
                    font-size: 11px;
                }
                QPushButton:hover {
                    background-color: #fdd835;
                }
                QPushButton:pressed {
                    background-color: #fbc02d;
                }
            """)
        else:
            # Normal gray button
            self.setStyleSheet("""
                QPushButton {
                    background-color: #e8e8e8;
                    border: 1px solid #d0d0d0;
                    border-radius: 2px;
                    padding: 5px 8px;
                    text-align: center;
                    font-size: 11px;
                    color: #333;
                }
                QPushButton:hover {
                    background-color: #f0f0f0;
                }
                QPushButton:pressed {
                    background-color: #d8d8d8;
                }
            """)
        self.setCursor(Qt.CursorShape.PointingHandCursor)


class ContractsTab(QWidget):
    """Contracts management - Hợp Đồng (Main tab matching mockup)"""
    
    def __init__(self):
        super().__init__()
        self.db = ShopsDB()
        try:
            self.db.connect()
        except Exception as e:
            QMessageBox.warning(self, "Cảnh báo", f"Không kết nối database: {e}")
        self.init_ui()
        self.load_data()
    
    def init_ui(self):
        """Initialize UI with sidebar + tables"""
        main_layout = QHBoxLayout()
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # ===== SIDEBAR (Left Panel) =====
        sidebar = self.create_sidebar()
        
        # ===== CONTENT (Right Panel) =====
        content_layout = QVBoxLayout()
        content_layout.setContentsMargins(10, 10, 10, 10)
        content_layout.setSpacing(5)
        
        # Top table - Hợp đồng
        top_label = QLabel("📋 Danh sách Hợp Đồng")
        top_font = QFont()
        top_font.setBold(True)
        top_font.setPointSize(10)
        top_label.setFont(top_font)
        content_layout.addWidget(top_label)
        
        self.top_table = QTableWidget()
        self.top_table.setColumnCount(16)
        self.top_table.setHorizontalHeaderLabels([
            "Mã HD", "Khách hàng", "Line", "Lý do", "Mã Line",
            "Copy Lô Nhạc", "Rung", "Tắt Rung", "Trạng Thái",
            "Tên Phone", "User icloud", "Pass icloud", "Xóa",
            "STT", "Ngày Tháng", "Chuyên"
        ])
        self.top_table.setStyleSheet(TABLE_STYLE)
        self.top_table.setAlternatingRowColors(True)
        self.top_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.top_table.setMaximumHeight(300)
        
        # Resize columns
        header = self.top_table.horizontalHeader()
        for i in range(self.top_table.columnCount()):
            header.setSectionResizeMode(i, QHeaderView.ResizeMode.ResizeToContents)
        
        content_layout.addWidget(self.top_table)
        
        # Bottom table - Thanh toán
        bottom_label = QLabel("💳 Chi tiết Thanh Toán")
        bottom_label.setFont(top_font)
        content_layout.addWidget(bottom_label)
        
        self.bottom_table = QTableWidget()
        self.bottom_table.setColumnCount(6)
        self.bottom_table.setHorizontalHeaderLabels([
            "Ngày", "Tiền hộ", "Tiền Cấn Lại", "Bóng", "Hủy", "Trạng Thái"
        ])
        self.bottom_table.setStyleSheet(TABLE_STYLE)
        self.bottom_table.setAlternatingRowColors(True)
        self.bottom_table.setMaximumHeight(150)
        
        header = self.bottom_table.horizontalHeader()
        for i in range(self.bottom_table.columnCount()):
            header.setSectionResizeMode(i, QHeaderView.ResizeMode.ResizeToContents)
        
        content_layout.addWidget(self.bottom_table)
        content_layout.addStretch()
        
        # Add to main layout
        main_layout.addWidget(sidebar, 0)
        
        content_widget = QWidget()
        content_widget.setLayout(content_layout)
        main_layout.addWidget(content_widget, 1)
        
        self.setLayout(main_layout)
    
    def create_sidebar(self) -> QWidget:
        """Create left sidebar with controls matching mockup"""
        sidebar = QWidget()
        sidebar.setMaximumWidth(220)
        sidebar.setStyleSheet("""
            QWidget {
                background-color: #f0f0f0;
                border-right: 1px solid #ddd;
            }
            QLabel {
                font-weight: bold;
                font-size: 11px;
                margin-top: 6px;
                margin-bottom: 4px;
                color: #333;
            }
            QLineEdit, QComboBox, QSpinBox {
                padding: 4px;
                border: 1px solid #ccc;
                border-radius: 2px;
                background-color: white;
                font-size: 11px;
            }
        """)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(2)
        
        # ===== CHỨC NĂNG (Functions) =====
        func_label = QLabel("Chức Năng")
        layout.addWidget(func_label)
        
        # Main options - radio buttons
        func_group = QButtonGroup()
        func_options = ["Chính", "Mãi 10", "Mãi 11", "Mãi 12", "Mãi 13"]
        
        for i, opt in enumerate(func_options):
            rb = QRadioButton(opt)
            if i == 0:
                rb.setChecked(True)
            func_group.addButton(rb, i)
            layout.addWidget(rb)
        
        # Sub-options as buttons
        for opt in ["QH13", "QH12", "QH9", "QH3", "QH7", "QH8"]:
            btn = CustomButton(opt)
            btn.setMaximumHeight(22)
            layout.addWidget(btn)
        
        layout.addSpacing(5)
        
        # ===== TÌM KIẾM (Search) =====
        search_label = QLabel("Tìm kiếm")
        layout.addWidget(search_label)
        
        mã_label = QLabel("Mã HD")
        layout.addWidget(mã_label)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Nhập mã...")
        self.search_input.setMaximumHeight(24)
        layout.addWidget(self.search_input)
        
        # Buttons row
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(3)
        
        timhd_btn = CustomButton("Tìm HD")
        timhd_btn.setMaximumHeight(24)
        btn_layout.addWidget(timhd_btn)
        
        refresh_btn = CustomButton("Refresh")
        refresh_btn.setMaximumHeight(24)
        refresh_btn.clicked.connect(self.load_data)
        btn_layout.addWidget(refresh_btn)
        
        layout.addLayout(btn_layout)
        
        # Check lịch bóng button (yellow)
        check_btn = CustomButton("Check Lịch Bóng", "primary")
        check_btn.setMaximumHeight(28)
        layout.addWidget(check_btn)
        
        layout.addSpacing(5)
        
        # ===== TÀI KHOẢN ICLOUD =====
        account_label = QLabel("Tài Khoản Icloud")
        layout.addWidget(account_label)
        
        user_label = QLabel("User")
        layout.addWidget(user_label)
        
        user_combo = QComboBox()
        user_combo.addItems(["Select", "User 1", "User 2", "User 3"])
        user_combo.setMaximumHeight(24)
        layout.addWidget(user_combo)
        
        pass_label = QLabel("Pass")
        layout.addWidget(pass_label)
        
        pass_input = QLineEdit()
        pass_input.setPlaceholderText("Password")
        pass_input.setEchoMode(QLineEdit.EchoMode.Password)
        pass_input.setMaximumHeight(24)
        layout.addWidget(pass_input)
        
        vip_check = QCheckBox("VIP")
        layout.addWidget(vip_check)
        
        file_link = QLabel("<a href='#'>File Xóa</a>")
        file_link.setStyleSheet("color: #0066cc; margin: 4px 0;")
        layout.addWidget(file_link)
        
        data_link = QLabel("<a href='#'>Nhập Dữ Liệu Góc</a>")
        data_link.setStyleSheet("color: #0066cc; margin: 2px 0;")
        layout.addWidget(data_link)
        
        info_link = QLabel("<a href='#'>Lưu Thông Tin</a>")
        info_link.setStyleSheet("color: #0066cc; margin: 2px 0;")
        layout.addWidget(info_link)
        
        layout.addSpacing(5)
        
        # ===== RES OPTIONS =====
        res_label = QLabel("Tùy chọn")
        layout.addWidget(res_label)
        
        res_group = QButtonGroup()
        for i, opt in enumerate(["Rung", "Skip", "Stop"]):
            rb = QRadioButton(opt)
            res_group.addButton(rb, i)
            layout.addWidget(rb)
        
        # ===== RANGE CONTROLS =====
        range_label = QLabel("Từ - Đến")
        layout.addWidget(range_label)
        
        range_layout = QHBoxLayout()
        range_layout.setSpacing(2)
        range_layout.setContentsMargins(0, 0, 0, 0)
        
        spin_from = QSpinBox()
        spin_from.setMaximumWidth(60)
        spin_from.setValue(0)
        range_layout.addWidget(spin_from)
        
        dash_label = QLabel("-")
        dash_label.setMaximumWidth(20)
        range_layout.addWidget(dash_label)
        
        spin_to = QSpinBox()
        spin_to.setMaximumWidth(60)
        spin_to.setValue(0)
        range_layout.addWidget(spin_to)
        
        range_layout.addStretch()
        layout.addLayout(range_layout)
        
        # ===== LINE OPTIONS =====
        line_label = QLabel("Dòng")
        layout.addWidget(line_label)
        
        line_group = QButtonGroup()
        for i, opt in enumerate(["Line 1", "Line 2"]):
            rb = QRadioButton(opt)
            line_group.addButton(rb, i)
            layout.addWidget(rb)
        
        # ===== STATUS FILTER =====
        status_label = QLabel("Trạng Thái")
        layout.addWidget(status_label)
        
        status_group = QButtonGroup()
        for i, opt in enumerate(["Quá Hạn", "Hàng Ngày", "Xóa"]):
            rb = QRadioButton(opt)
            status_group.addButton(rb, i)
            layout.addWidget(rb)
        
        layout.addStretch()
        
        sidebar.setLayout(layout)
        return sidebar
    
    def load_data(self):
        """Load data from database"""
        try:
            shops = self.db.get_all_shops()
            self.populate_table(shops)
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Không thể tải dữ liệu: {str(e)}")
    
    def populate_table(self, shops: list):
        """Populate table with shops data"""
        self.top_table.setRowCount(0)
        for row_num, shop in enumerate(shops[:20]):
            self.top_table.insertRow(row_num)
            items = [
                str(shop.get('id', '')),
                shop.get('name', ''),
                f"Line {row_num+1}",
                shop.get('address', ''),
                str(row_num+1),
                "📋",
                "🔊",
                "🔇",
                "✓",
                shop.get('phone', ''),
                "user@icloud",
                "●●●●",
                "🗑",
                str(row_num+1),
                shop.get('created_date', ''),
                "VN"
            ]
            for col_num, item_text in enumerate(items):
                cell = QTableWidgetItem(str(item_text))
                self.top_table.setItem(row_num, col_num, cell)


class StaffTab(QWidget):
    """Staff management tab"""
    
    def __init__(self):
        super().__init__()
        self.db = StaffDB()
        try:
            self.db.connect()
        except Exception as e:
            QMessageBox.warning(self, "Cảnh báo", f"Không kết nối database: {e}")
        self.init_ui()
        self.load_data()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search bar
        search_layout = QHBoxLayout()
        search_label = QLabel("🔍 Tìm kiếm:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Tên, username, email...")
        search_btn = CustomButton("Tìm")
        search_btn.clicked.connect(self.search)
        
        refresh_btn = CustomButton("Refresh")
        refresh_btn.clicked.connect(self.load_data)
        
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(search_btn)
        search_layout.addWidget(refresh_btn)
        search_layout.addStretch()
        
        layout.addLayout(search_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "ID", "Username", "Tên đầy đủ", "Email", "SĐT", "Cửa hàng", "Trạng thái"
        ])
        self.table.setStyleSheet(TABLE_STYLE)
        self.table.setAlternatingRowColors(True)
        
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.table)
        self.setLayout(layout)
    
    def load_data(self):
        """Load staff from database"""
        try:
            staff = self.db.get_all_staff()
            self.populate_table(staff)
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Không thể tải dữ liệu: {str(e)}")
    
    def populate_table(self, staff: list):
        """Populate table with staff data"""
        self.table.setRowCount(0)
        for row_num, person in enumerate(staff):
            self.table.insertRow(row_num)
            items = [
                str(person.get('id', '')),
                person.get('username', ''),
                person.get('full_name', ''),
                person.get('email', ''),
                person.get('phone', ''),
                person.get('shop_name', ''),
                "✓" if person.get('status') == 1 else "✗"
            ]
            for col_num, item_text in enumerate(items):
                self.table.setItem(row_num, col_num, QTableWidgetItem(item_text))
    
    def search(self):
        """Search staff"""
        keyword = self.search_input.text().strip()
        if not keyword:
            self.load_data()
            return
        try:
            staff = self.db.search_staff(keyword)
            self.populate_table(staff)
        except Exception as e:
            QMessageBox.warning(self, "Lỗi", str(e))


class InstallmentTab(QWidget):
    """Installment management tab"""
    
    def __init__(self):
        super().__init__()
        self.db = InstallmentDB()
        try:
            self.db.connect()
        except Exception as e:
            QMessageBox.warning(self, "Cảnh báo", f"Không kết nối database: {e}")
        self.init_ui()
        self.load_data()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search bar
        search_layout = QHBoxLayout()
        search_label = QLabel("🔍 Tìm kiếm:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Tên cửa hàng, thợ lắp...")
        search_btn = CustomButton("Tìm")
        search_btn.clicked.connect(self.search)
        
        refresh_btn = CustomButton("Refresh")
        refresh_btn.clicked.connect(self.load_data)
        
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(search_btn)
        search_layout.addWidget(refresh_btn)
        search_layout.addStretch()
        
        layout.addLayout(search_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels([
            "ID", "Cửa hàng", "Thợ lắp", "Tổng tiền",
            "Đã trả", "Trạng thái", "Ngày trả tiếp", "Ngày tạo"
        ])
        self.table.setStyleSheet(TABLE_STYLE)
        self.table.setAlternatingRowColors(True)
        
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.table)
        self.setLayout(layout)
    
    def load_data(self):
        """Load installments"""
        try:
            installments = self.db.get_all_installments()
            self.populate_table(installments)
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Không thể tải dữ liệu: {str(e)}")
    
    def populate_table(self, installments: list):
        """Populate table"""
        self.table.setRowCount(0)
        for row_num, inst in enumerate(installments):
            self.table.insertRow(row_num)
            items = [
                str(inst.get('id', '')),
                inst.get('shop_name', ''),
                inst.get('installer_names', ''),
                f"{inst.get('total_amount', 0):,}",
                f"{inst.get('paid_amount', 0):,}",
                inst.get('payment_status', ''),
                inst.get('next_payment_date', ''),
                inst.get('created_date', '')
            ]
            for col_num, item_text in enumerate(items):
                self.table.setItem(row_num, col_num, QTableWidgetItem(item_text))
    
    def search(self):
        """Search installments"""
        keyword = self.search_input.text().strip()
        if not keyword:
            self.load_data()
            return
        try:
            installments = self.db.search_installments(keyword)
            self.populate_table(installments)
        except Exception as e:
            QMessageBox.warning(self, "Lỗi", str(e))


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_TITLE} - v{APP_VERSION}")
        self.setGeometry(50, 50, WINDOW_WIDTH, WINDOW_HEIGHT)
        
        # Initialize current tab
        self.current_tab = None
        self.show_contracts_tab()
    
    def show_contracts_tab(self):
        """Show contracts tab"""
        if self.current_tab:
            self.current_tab.deleteLater()
        self.current_tab = ContractsTab()
        self.setCentralWidget(self.current_tab)
    
    def show_staff_tab(self):
        """Show staff tab"""
        if self.current_tab:
            self.current_tab.deleteLater()
        self.current_tab = StaffTab()
        self.setCentralWidget(self.current_tab)
    
    def show_installment_tab(self):
        """Show installment tab"""
        if self.current_tab:
            self.current_tab.deleteLater()
        self.current_tab = InstallmentTab()
        self.setCentralWidget(self.current_tab)


def main():
    """Application entry point"""
    app = QApplication(sys.argv)
    window = MainWindow()
    
    # Add top menu bar for navigation
    menubar = window.menuBar()
    
    menu_tools = menubar.addMenu("📋 Hợp Đồng")
    action1 = menu_tools.addAction("Danh sách Hợp Đồng")
    action1.triggered.connect(window.show_contracts_tab)
    
    menu_staff = menubar.addMenu("👤 Nhân Viên")
    action2 = menu_staff.addAction("Danh sách Nhân Viên")
    action2.triggered.connect(window.show_staff_tab)
    
    menu_install = menubar.addMenu("💳 Trả Góp")
    action3 = menu_install.addAction("Danh sách Trả Góp")
    action3.triggered.connect(window.show_installment_tab)
    
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
