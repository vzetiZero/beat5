"""
Beat5 Desktop Application - Main Entry Point
Quản lý Web Cam Đo - Ứng dụng Desktop
"""
import sys
import os
from pathlib import Path
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QPushButton, QLabel, QLineEdit, QTableWidget, QTableWidgetItem,
    QMessageBox, QHeaderView, QSplitter
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QIcon, QFont

from config import APP_TITLE, APP_VERSION, WINDOW_WIDTH, WINDOW_HEIGHT, SIDEBAR_STYLE, TABLE_STYLE
from database import ShopsDB, StaffDB, InstallmentDB


class SidebarButton(QPushButton):
    """Custom sidebar button"""
    def __init__(self, text, icon_char=None):
        super().__init__(text)
        self.setStyleSheet("""
            QPushButton {
                background-color: #f0f0f0;
                border: none;
                border-radius: 4px;
                padding: 10px;
                text-align: left;
                font-size: 13px;
                color: #333;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
            }
        """)
        self.setCursor(Qt.CursorShape.PointingHandCursor)


class ShopsTab(QWidget):
    """Shops management tab"""
    
    def __init__(self):
        super().__init__()
        self.db = ShopsDB()
        self.db.connect()
        self.init_ui()
        self.load_shops()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search bar
        search_layout = QHBoxLayout()
        search_label = QLabel("Tìm kiếm:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Tên cửa hàng, địa chỉ, SĐT...")
        search_btn = QPushButton("🔍 Tìm")
        search_btn.clicked.connect(self.search_shops)
        
        refresh_btn = QPushButton("🔄 Refresh")
        refresh_btn.clicked.connect(self.load_shops)
        
        add_btn = QPushButton("➕ Thêm mới")
        add_btn.clicked.connect(self.add_shop)
        
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(search_btn)
        search_layout.addWidget(refresh_btn)
        search_layout.addWidget(add_btn)
        search_layout.addStretch()
        
        layout.addLayout(search_layout)
        
        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels([
            "ID", "Tên cửa hàng", "Địa chỉ", "SĐT", 
            "Người đại diện", "Tổng tiền", "Trạng thái", "Ngày tạo"
        ])
        self.table.setStyleSheet(TABLE_STYLE)
        self.table.setAlternatingRowColors(True)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        
        # Resize columns
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.table)
        self.setLayout(layout)
    
    def load_shops(self):
        """Load shops from database"""
        try:
            shops = self.db.get_all_shops()
            self.populate_table(shops)
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Không thể tải dữ liệu: {str(e)}")
    
    def populate_table(self, shops: list):
        """Populate table with shops data"""
        self.table.setRowCount(0)
        for row_num, shop in enumerate(shops):
            self.table.insertRow(row_num)
            items = [
                str(shop.get('id', '')),
                shop.get('name', ''),
                shop.get('address', ''),
                shop.get('phone', ''),
                shop.get('represent', ''),
                f"{shop.get('total_money', 0):,} ₫",
                "✓ Hoạt động" if shop.get('status') == 1 else "✗ Đã khóa",
                shop.get('created_date', '')
            ]
            for col_num, item_text in enumerate(items):
                self.table.setItem(row_num, col_num, QTableWidgetItem(item_text))
    
    def search_shops(self):
        """Search shops"""
        keyword = self.search_input.text().strip()
        if not keyword:
            self.load_shops()
            return
        
        try:
            shops = self.db.search_shops(keyword)
            self.populate_table(shops)
        except Exception as e:
            QMessageBox.warning(self, "Lỗi tìm kiếm", str(e))
    
    def add_shop(self):
        """Add new shop - placeholder"""
        QMessageBox.information(self, "Thêm mới", "Tính năng thêm cửa hàng sẽ được cập nhật")


class StaffTab(QWidget):
    """Staff management tab"""
    
    def __init__(self):
        super().__init__()
        self.db = StaffDB()
        self.db.connect()
        self.init_ui()
        self.load_staff()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search bar
        search_layout = QHBoxLayout()
        search_label = QLabel("Tìm kiếm:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Tên, username, email...")
        search_btn = QPushButton("🔍 Tìm")
        search_btn.clicked.connect(self.search_staff)
        
        refresh_btn = QPushButton("🔄 Refresh")
        refresh_btn.clicked.connect(self.load_staff)
        
        add_btn = QPushButton("➕ Thêm mới")
        
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(search_btn)
        search_layout.addWidget(refresh_btn)
        search_layout.addWidget(add_btn)
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
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.table)
        self.setLayout(layout)
    
    def load_staff(self):
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
                "✓ Hoạt động" if person.get('status') == 1 else "✗ Đã khóa"
            ]
            for col_num, item_text in enumerate(items):
                self.table.setItem(row_num, col_num, QTableWidgetItem(item_text))
    
    def search_staff(self):
        """Search staff"""
        keyword = self.search_input.text().strip()
        if not keyword:
            self.load_staff()
            return
        
        try:
            staff = self.db.search_staff(keyword)
            self.populate_table(staff)
        except Exception as e:
            QMessageBox.warning(self, "Lỗi tìm kiếm", str(e))


class InstallmentTab(QWidget):
    """Installment management tab"""
    
    def __init__(self):
        super().__init__()
        self.db = InstallmentDB()
        self.db.connect()
        self.init_ui()
        self.load_installments()
    
    def init_ui(self):
        layout = QVBoxLayout()
        
        # Search and filter
        search_layout = QHBoxLayout()
        search_label = QLabel("Tìm kiếm:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Tên cửa hàng, tên thợ lắp...")
        search_btn = QPushButton("🔍 Tìm")
        search_btn.clicked.connect(self.search_installments)
        
        refresh_btn = QPushButton("🔄 Refresh")
        refresh_btn.clicked.connect(self.load_installments)
        
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
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.table)
        self.setLayout(layout)
    
    def load_installments(self):
        """Load installments from database"""
        try:
            installments = self.db.get_all_installments()
            self.populate_table(installments)
        except Exception as e:
            QMessageBox.critical(self, "Lỗi", f"Không thể tải dữ liệu: {str(e)}")
    
    def populate_table(self, installments: list):
        """Populate table with installment data"""
        self.table.setRowCount(0)
        for row_num, inst in enumerate(installments):
            self.table.insertRow(row_num)
            items = [
                str(inst.get('id', '')),
                inst.get('shop_name', ''),
                inst.get('installer_names', ''),
                f"{inst.get('total_amount', 0):,} ₫",
                f"{inst.get('paid_amount', 0):,} ₫",
                inst.get('payment_status', ''),
                inst.get('next_payment_date', ''),
                inst.get('created_date', '')
            ]
            for col_num, item_text in enumerate(items):
                self.table.setItem(row_num, col_num, QTableWidgetItem(item_text))
    
    def search_installments(self):
        """Search installments"""
        keyword = self.search_input.text().strip()
        if not keyword:
            self.load_installments()
            return
        
        try:
            installments = self.db.search_installments(keyword)
            self.populate_table(installments)
        except Exception as e:
            QMessageBox.warning(self, "Lỗi tìm kiếm", str(e))


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle(f"{APP_TITLE} - v{APP_VERSION}")
        self.setGeometry(100, 100, WINDOW_WIDTH, WINDOW_HEIGHT)
        
        # Create central widget and main layout
        central_widget = QWidget()
        main_layout = QHBoxLayout()
        
        # Sidebar
        sidebar = self.create_sidebar()
        
        # Content area with tabs
        self.tabs_container = QWidget()
        tabs_layout = QVBoxLayout()
        tabs_layout.setContentsMargins(0, 0, 0, 0)
        self.tabs_container.setLayout(tabs_layout)
        
        # Initially show shops tab
        self.show_shops_tab()
        
        # Add to main layout
        main_layout.addWidget(sidebar, 0)
        main_layout.addWidget(self.tabs_container, 1)
        
        central_widget.setLayout(main_layout)
        self.setCentralWidget(central_widget)
    
    def create_sidebar(self) -> QWidget:
        """Create sidebar with navigation buttons"""
        sidebar = QWidget()
        sidebar.setStyleSheet("""
            QWidget {
                background-color: #f5f5f5;
                border-right: 1px solid #ddd;
            }
        """)
        sidebar.setMaximumWidth(200)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(5)
        
        # Title
        title = QLabel(APP_TITLE)
        title_font = QFont()
        title_font.setPointSize(11)
        title_font.setBold(True)
        title.setFont(title_font)
        layout.addWidget(title)
        
        layout.addSpacing(10)
        
        # Navigation buttons
        shops_btn = SidebarButton("🏪 Cửa hàng")
        shops_btn.clicked.connect(self.show_shops_tab)
        layout.addWidget(shops_btn)
        
        staff_btn = SidebarButton("👤 Nhân viên")
        staff_btn.clicked.connect(self.show_staff_tab)
        layout.addWidget(staff_btn)
        
        installment_btn = SidebarButton("💳 Trả góp")
        installment_btn.clicked.connect(self.show_installment_tab)
        layout.addWidget(installment_btn)
        
        layout.addSpacing(20)
        
        # Other menu items
        settings_btn = SidebarButton("⚙️ Cài đặt")
        layout.addWidget(settings_btn)
        
        export_btn = SidebarButton("📥 Xuất dữ liệu")
        layout.addWidget(export_btn)
        
        import_btn = SidebarButton("📤 Nhập dữ liệu")
        layout.addWidget(import_btn)
        
        layout.addStretch()
        
        # About and exit
        about_btn = SidebarButton("ℹ️ Về ứng dụng")
        layout.addWidget(about_btn)
        
        exit_btn = SidebarButton("🚪 Thoát")
        exit_btn.clicked.connect(self.close)
        layout.addWidget(exit_btn)
        
        sidebar.setLayout(layout)
        return sidebar
    
    def clear_tabs_container(self):
        """Clear the tabs container"""
        while self.tabs_container.layout().count():
            self.tabs_container.layout().takeAt(0).widget().deleteLater()
    
    def show_shops_tab(self):
        """Show shops management tab"""
        self.clear_tabs_container()
        shop_tab = ShopsTab()
        self.tabs_container.layout().addWidget(shop_tab)
    
    def show_staff_tab(self):
        """Show staff management tab"""
        self.clear_tabs_container()
        staff_tab = StaffTab()
        self.tabs_container.layout().addWidget(staff_tab)
    
    def show_installment_tab(self):
        """Show installment management tab"""
        self.clear_tabs_container()
        inst_tab = InstallmentTab()
        self.tabs_container.layout().addWidget(inst_tab)


def main():
    """Application entry point"""
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
