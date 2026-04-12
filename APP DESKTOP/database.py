"""
Database connection and query helpers
"""
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from config import SHOPS_DB, STAFF_DB, INSTALLMENT_DB, AUDIT_LOG_DB

class DatabaseConnection:
    """Manage SQLite database connections"""
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.connection = None
    
    def connect(self):
        """Open database connection"""
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {self.db_path}")
        self.connection = sqlite3.connect(str(self.db_path))
        self.connection.row_factory = sqlite3.Row
        return self.connection
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict]:
        """Execute SELECT query and return results"""
        if not self.connection:
            self.connect()
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def execute_update(self, query: str, params: tuple = ()) -> int:
        """Execute INSERT/UPDATE/DELETE query"""
        if not self.connection:
            self.connect()
        cursor = self.connection.cursor()
        cursor.execute(query, params)
        self.connection.commit()
        return cursor.rowcount
    
    def get_table_info(self, table_name: str) -> List[Dict]:
        """Get column information for a table"""
        query = f"PRAGMA table_info({table_name})"
        return self.execute_query(query)


class ShopsDB(DatabaseConnection):
    """Shops database operations"""
    
    def __init__(self):
        super().__init__(SHOPS_DB)
    
    def get_all_shops(self) -> List[Dict]:
        """Get all shops"""
        query = """
            SELECT id, name, address, phone, represent, total_money, status, created_date
            FROM shops
            ORDER BY created_date DESC
        """
        return self.execute_query(query)
    
    def get_shop_by_id(self, shop_id: int) -> Optional[Dict]:
        """Get shop by ID"""
        query = "SELECT * FROM shops WHERE id = ?"
        results = self.execute_query(query, (shop_id,))
        return results[0] if results else None
    
    def search_shops(self, keyword: str) -> List[Dict]:
        """Search shops by name or address"""
        query = """
            SELECT * FROM shops
            WHERE name LIKE ? OR address LIKE ? OR phone LIKE ?
            ORDER BY created_date DESC
        """
        search_term = f"%{keyword}%"
        return self.execute_query(query, (search_term, search_term, search_term))


class StaffDB(DatabaseConnection):
    """Staff database operations"""
    
    def __init__(self):
        super().__init__(STAFF_DB)
    
    def get_all_staff(self) -> List[Dict]:
        """Get all staff"""
        query = """
            SELECT id, username, full_name, email, phone, shop_name, status
            FROM staff
            ORDER BY id DESC
        """
        return self.execute_query(query)
    
    def get_staff_by_id(self, staff_id: int) -> Optional[Dict]:
        """Get staff by ID"""
        query = "SELECT * FROM staff WHERE id = ?"
        results = self.execute_query(query, (staff_id,))
        return results[0] if results else None
    
    def search_staff(self, keyword: str) -> List[Dict]:
        """Search staff by name, username, or email"""
        query = """
            SELECT * FROM staff
            WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?
            ORDER BY id DESC
        """
        search_term = f"%{keyword}%"
        return self.execute_query(query, (search_term, search_term, search_term))


class InstallmentDB(DatabaseConnection):
    """Installment database operations"""
    
    def __init__(self):
        super().__init__(INSTALLMENT_DB)
    
    def get_all_installments(self, limit: int = 100) -> List[Dict]:
        """Get recent installments"""
        query = """
            SELECT id, shop_name, installer_names, total_amount, paid_amount, 
                   payment_status, next_payment_date, created_date
            FROM installments
            ORDER BY created_date DESC
            LIMIT ?
        """
        return self.execute_query(query, (limit,))
    
    def search_installments(self, keyword: str) -> List[Dict]:
        """Search installments by shop name or installer"""
        query = """
            SELECT * FROM installments
            WHERE shop_name LIKE ? OR installer_names LIKE ?
            ORDER BY created_date DESC
            LIMIT 100
        """
        search_term = f"%{keyword}%"
        return self.execute_query(query, (search_term, search_term))
    
    def get_installments_by_status(self, status: str) -> List[Dict]:
        """Get installments by payment status"""
        query = """
            SELECT * FROM installments
            WHERE payment_status = ?
            ORDER BY next_payment_date ASC
        """
        return self.execute_query(query, (status,))
