"""
Configuration and database paths
"""
import os
from pathlib import Path

# Project paths
APP_DIR = Path(__file__).parent
PROJECT_ROOT = APP_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"

# Database paths
SHOPS_DB = DATA_DIR / "shops.sqlite"
STAFF_DB = DATA_DIR / "staff.sqlite"
INSTALLMENT_DB = DATA_DIR / "installments.sqlite"
AUDIT_LOG_DB = DATA_DIR / "audit-log.sqlite"
TRASH_DB = DATA_DIR / "trash.sqlite"

# App configuration
APP_TITLE = "Beat5 - Quản Lý Web Cam Đo"
APP_VERSION = "1.0.0"
WINDOW_WIDTH = 1400
WINDOW_HEIGHT = 800

# Themes
SIDEBAR_STYLE = """
    QWidget {
        background-color: #f5f5f5;
        color: #333;
    }
    QPushButton {
        background-color: #f0f0f0;
        border: none;
        border-radius: 4px;
        padding: 8px;
        text-align: left;
        font-size: 13px;
    }
    QPushButton:hover {
        background-color: #e0e0e0;
    }
    QPushButton:pressed {
        background-color: #d0d0d0;
    }
"""

TABLE_STYLE = """
    QTableWidget {
        background-color: white;
        alternate-background-color: #f9f9f9;
        gridline-color: #d0d0d0;
    }
    QHeaderView::section {
        background-color: #f0f0f0;
        padding: 5px;
        border: none;
        border-right: 1px solid #d0d0d0;
        font-weight: bold;
    }
"""
