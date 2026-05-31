import sqlite3
from datetime import datetime

DB_FILE = 'busnexus.db'

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Routes
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_point TEXT,
        end_point TEXT,
        stops INTEGER,
        distance REAL,
        bus_id TEXT,
        departure TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Buses
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS buses (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        registration TEXT,
        model TEXT,
        capacity INTEGER,
        route_id TEXT,
        driver_id TEXT,
        year INTEGER,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Drivers
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        license_number TEXT UNIQUE,
        license_type TEXT,
        license_expiry DATE,
        experience INTEGER,
        address TEXT,
        bus_id TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Students
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class TEXT,
        phone TEXT,
        parent_name TEXT,
        parent_phone TEXT,
        address TEXT,
        bus_id TEXT,
        route_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Activity Log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        message TEXT,
        color TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Notifications
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        type TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Users (Auth)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    conn.commit()
    conn.close()

def log_activity(type, message, color):
    conn = get_db()
    conn.execute('INSERT INTO activity_log (type, message, color) VALUES (?, ?, ?)', (type, message, color))
    conn.commit()
    conn.close()

def log_notification(user_id, type, message):
    conn = get_db()
    conn.execute('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', (user_id, type, message))
    conn.commit()
    conn.close()

def get_notifications(user_id):
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute('''
        SELECT * FROM notifications 
        WHERE user_id IS NULL OR user_id = ? 
        ORDER BY created_at DESC LIMIT 50
    ''', (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def mark_notification_read(notif_id, user_id):
    conn = get_db()
    conn.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id IS NULL OR user_id = ?)', (notif_id, user_id))
    conn.commit()
    conn.close()

def mark_all_notifications_read(user_id):
    conn = get_db()
    conn.execute('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ?', (user_id,))
    conn.commit()
    conn.close()

def delete_notification(notif_id, user_id):
    conn = get_db()
    conn.execute('DELETE FROM notifications WHERE id = ? AND (user_id IS NULL OR user_id = ?)', (notif_id, user_id))
    conn.commit()
    conn.close()

def seed_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if empty
    if cursor.execute('SELECT COUNT(*) FROM buses').fetchone()[0] > 0:
        conn.close()
        return False
        
    routes = [
        ('RT-DEMO1', 'North Zone — Route A', 'School Main Gate', 'Sector 22, North City', 8, 14.5, 'BUS-DEMO1', '07:30', 'Active'),
        ('RT-DEMO2', 'South Zone — Route B', 'School Main Gate', 'Green Park Colony', 6, 11.2, 'BUS-DEMO2', '07:45', 'Active'),
        ('RT-DEMO3', 'East Zone — Route C', 'School Main Gate', 'Sunrise Township', 10, 18.0, 'BUS-DEMO3', '07:15', 'Active'),
    ]
    cursor.executemany('INSERT INTO routes (id, name, start_point, end_point, stops, distance, bus_id, departure, status) VALUES (?,?,?,?,?,?,?,?,?)', routes)
    
    buses = [
        ('BUS-DEMO1', 'BUS-001', 'MH-01-AB-1234', 'Tata Starbus 52', 52, 'RT-DEMO1', 'DRV-DEMO1', 2021, 'Active'),
        ('BUS-DEMO2', 'BUS-002', 'MH-01-CD-5678', 'Ashok Leyland 55', 55, 'RT-DEMO2', 'DRV-DEMO2', 2020, 'Active'),
        ('BUS-DEMO3', 'BUS-003', 'MH-01-EF-9012', 'Tata LP 713', 40, 'RT-DEMO3', 'DRV-DEMO3', 2019, 'Maintenance'),
        ('BUS-DEMO4', 'BUS-004', 'MH-01-GH-3456', 'Eicher 20.15', 35, '', '', 2022, 'Active'),
    ]
    cursor.executemany('INSERT INTO buses (id, number, registration, model, capacity, route_id, driver_id, year, status) VALUES (?,?,?,?,?,?,?,?,?)', buses)
    
    drivers = [
        ('DRV-DEMO1', 'Rajesh Kumar', '9876543210', 'MH0120210001234', 'HPMV', '2026-08-15', 8, 'Plot 12, Shivaji Nagar, Pune', 'BUS-DEMO1', 'Active'),
        ('DRV-DEMO2', 'Suresh Patil', '9845123456', 'MH0120190005678', 'HMV', '2025-03-20', 12, '45, Gandhi Road, Pune', 'BUS-DEMO2', 'Active'),
        ('DRV-DEMO3', 'Mahesh Yadav', '9012345678', 'MH0120220009012', 'HPMV', '2026-12-10', 5, 'A-3, Anand Colony, Pune', 'BUS-DEMO3', 'On Leave'),
        ('DRV-DEMO4', 'Vinod Sharma', '9654321098', 'MH0120180003456', 'Transport', '2024-11-05', 15, '88, MG Road, Pune', 'BUS-DEMO4', 'Active'),
    ]
    cursor.executemany('INSERT INTO drivers (id, name, phone, license_number, license_type, license_expiry, experience, address, bus_id, status) VALUES (?,?,?,?,?,?,?,?,?,?)', drivers)
    
    students = [
        ('STU-DEMO01', 'Aryan Sharma', 'Grade 8-A', '', 'Ramesh Sharma', '9876501234', '23, Laxmi Nagar, Sector 22', 'BUS-DEMO1', 'RT-DEMO1'),
        ('STU-DEMO02', 'Priya Desai', 'Grade 6-B', '', 'Anjali Desai', '9845067890', '7, Rose Garden, Sector 22', 'BUS-DEMO1', 'RT-DEMO1'),
        ('STU-DEMO03', 'Rohan Mehta', 'Grade 10-C', '', 'Sunil Mehta', '9012378901', '101, Green Acres, North City', 'BUS-DEMO1', 'RT-DEMO1'),
        ('STU-DEMO04', 'Sneha Kulkarni', 'Grade 5-A', '', 'Pooja Kulkarni', '9654312345', '55, Shanti Path, Green Park', 'BUS-DEMO2', 'RT-DEMO2'),
        ('STU-DEMO05', 'Aditya Joshi', 'Grade 9-B', '', 'Vikas Joshi', '9123456789', '12, Park Lane, Green Park Colony', 'BUS-DEMO2', 'RT-DEMO2'),
        ('STU-DEMO06', 'Kavya Nair', 'Grade 7-A', '', 'Sreeja Nair', '9876123456', '88, Sunrise Blvd, Township', 'BUS-DEMO3', 'RT-DEMO3'),
        ('STU-DEMO07', 'Dev Patel', 'Grade 4-C', '', 'Hiten Patel', '9845678901', '34, Sunrise Tower, East Zone', 'BUS-DEMO3', 'RT-DEMO3'),
        ('STU-DEMO08', 'Ananya Singh', 'Grade 11-B', '9012345600', 'Amit Singh', '9012300678', '61, Sunrise Residency, East', 'BUS-DEMO3', 'RT-DEMO3'),
    ]
    cursor.executemany('INSERT INTO students (id, name, class, phone, parent_name, parent_phone, address, bus_id, route_id) VALUES (?,?,?,?,?,?,?,?,?)', students)
    
    # Seed sample notifications
    notifications = [
        (None, 'danger', 'Driver Vinod Sharma\'s license has expired (2024-11-05). Immediate action required!'),
        (None, 'warning', 'Driver Suresh Patil\'s license will expire in 20 days (2025-03-20).'),
        (None, 'info', 'Bus BUS-003 status changed to Maintenance.'),
        (None, 'success', 'Sample fleet data loaded successfully. BusNexus systems are operational!'),
    ]
    cursor.executemany('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', notifications)
    
    conn.commit()
    log_activity('bus', 'Sample fleet data loaded', 'cyan')
    conn.close()
    return True

def clear_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM buses')
    cursor.execute('DELETE FROM drivers')
    cursor.execute('DELETE FROM students')
    cursor.execute('DELETE FROM routes')
    cursor.execute('DELETE FROM activity_log')
    cursor.execute('DELETE FROM notifications')
    conn.commit()
    conn.close()
