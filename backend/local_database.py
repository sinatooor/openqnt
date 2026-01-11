import sqlite3
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_NAME = "strategies.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    # Users Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Strategies Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS strategies (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            xml TEXT,
            python_code TEXT,
            block_count INTEGER,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Seed Admin User
    c.execute("SELECT * FROM users WHERE email = 'admin@admin.com'")
    if not c.fetchone():
        print("[DB] Seeding admin user...")
        c.execute(
            "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), "admin@admin.com", "admin@admin.com", "Admin User")
        )
    
    conn.commit()
    conn.close()

# --- User Actions ---

def get_user_by_credentials(email, password):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password))
    user = c.fetchone()
    conn.close()
    if user:
        return dict(user)
    return None

def get_user_by_id(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    conn.close()
    if user:
        return dict(user)
    return None

# --- Strategy Actions ---

def save_user_strategy(user_id, name, xml, python_code="", block_count=0):
    conn = get_db()
    c = conn.cursor()
    strategy_id = str(uuid.uuid4())
    c.execute(
        '''INSERT INTO strategies (id, user_id, name, xml, python_code, block_count, saved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (strategy_id, user_id, name, xml, python_code, block_count, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return strategy_id

def get_user_strategies(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM strategies WHERE user_id = ? ORDER BY saved_at DESC", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_user_strategy(strategy_id, user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM strategies WHERE id = ? AND user_id = ?", (strategy_id, user_id))
    conn.commit()
    conn.close()
