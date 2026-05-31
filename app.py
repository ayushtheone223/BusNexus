import io
import csv
import uuid
from functools import wraps
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import database as db

app = Flask(__name__)
app.secret_key = 'super-secret-busnexus-key-change-in-production'
db.init_db()

# --- Auth Decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
            return redirect(url_for('auth'))
        return f(*args, **kwargs)
    return decorated_function


# --- Page Routes ---
@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('home.html')

@app.route('/login')
def auth():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('auth.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('index.html')


# --- Auth API Endpoints ---
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'status': 'error', 'message': 'Missing fields'}), 400
        
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        # Check if email exists
        if cursor.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
            return jsonify({'status': 'error', 'message': 'Email already exists'}), 400
            
        user_id = 'USR-' + uuid.uuid4().hex[:8].upper()
        hashed_pw = generate_password_hash(password)
        
        cursor.execute('''
            INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)
        ''', (user_id, name, email, hashed_pw))
        conn.commit()
        
        session['user_id'] = user_id
        session['user_name'] = name
        return jsonify({'status': 'success', 'message': 'Account created'})
    finally:
        conn.close()


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'status': 'error', 'message': 'Missing credentials'}), 400
        
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        user = cursor.execute('SELECT id, name, password_hash FROM users WHERE email = ?', (email,)).fetchone()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            return jsonify({'status': 'success', 'message': 'Logged in successfully'})
            
        return jsonify({'status': 'error', 'message': 'Invalid email or password'}), 401
    finally:
        conn.close()

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'success'})

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({
        'status': 'success',
        'id': session.get('user_id'),
        'name': session.get('user_name')
    })


# --- Notifications API Endpoints ---
@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    user_id = session.get('user_id')
    notifs = db.get_notifications(user_id)
    return jsonify(notifs)

@app.route('/api/notifications/<int:id>/read', methods=['POST'])
@login_required
def mark_notif_read(id):
    user_id = session.get('user_id')
    db.mark_notification_read(id, user_id)
    return jsonify({'status': 'success'})

@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_notifs_read():
    user_id = session.get('user_id')
    db.mark_all_notifications_read(user_id)
    return jsonify({'status': 'success'})

@app.route('/api/notifications/<int:id>', methods=['DELETE'])
@login_required
def delete_notif(id):
    user_id = session.get('user_id')
    db.delete_notification(id, user_id)
    return jsonify({'status': 'success'})


# --- Dashboard API Endpoints ---
@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    conn = db.get_db()
    cursor = conn.cursor()
    
    buses = [dict(r) for r in cursor.execute('SELECT * FROM buses').fetchall()]
    drivers = [dict(r) for r in cursor.execute('SELECT * FROM drivers').fetchall()]
    students = [dict(r) for r in cursor.execute('SELECT * FROM students').fetchall()]
    routes = [dict(r) for r in cursor.execute('SELECT * FROM routes').fetchall()]
    activity = [dict(r) for r in cursor.execute('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20').fetchall()]
    
    conn.close()
    
    return jsonify({
        'buses': buses,
        'drivers': drivers,
        'students': students,
        'routes': routes,
        'activity': activity
    })

# --- Buses ---
@app.route('/api/buses', methods=['GET'])
@login_required
def get_buses():
    conn = db.get_db()
    buses = [dict(r) for r in conn.execute('SELECT * FROM buses').fetchall()]
    conn.close()
    return jsonify(buses)

@app.route('/api/buses', methods=['POST'])
@login_required
def add_bus():
    data = request.json
    conn = db.get_db()
    conn.execute('''
        INSERT INTO buses (id, number, registration, model, capacity, route_id, driver_id, year, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['id'], data['number'], data.get('reg'), data.get('model'), data['capacity'], data.get('routeId'), data.get('driverId'), data.get('year'), data['status']))
    conn.commit()
    conn.close()
    db.log_activity('bus', f"Bus {data['number']} registered", 'cyan')
    db.log_notification(None, 'success', f"Bus {data['number']} was successfully registered in the fleet.")
    return jsonify({'status': 'success'})

@app.route('/api/buses/<id>', methods=['PUT'])
@login_required
def update_bus(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE buses SET number=?, registration=?, model=?, capacity=?, route_id=?, driver_id=?, year=?, status=? WHERE id=?
    ''', (data['number'], data.get('reg'), data.get('model'), data['capacity'], data.get('routeId'), data.get('driverId'), data.get('year'), data['status'], id))
    conn.commit()
    conn.close()
    db.log_activity('bus', f"Bus {data['number']} updated", 'cyan')
    return jsonify({'status': 'success'})

@app.route('/api/buses/<id>', methods=['DELETE'])
@login_required
def delete_bus(id):
    conn = db.get_db()
    conn.execute('DELETE FROM buses WHERE id=?', (id,))
    conn.commit()
    conn.close()
    db.log_activity('bus', f"Bus removed", 'cyan')
    return jsonify({'status': 'success'})


# --- Routes ---
@app.route('/api/routes', methods=['GET'])
@login_required
def get_routes():
    conn = db.get_db()
    routes = [dict(r) for r in conn.execute('SELECT * FROM routes').fetchall()]
    conn.close()
    return jsonify(routes)

@app.route('/api/routes', methods=['POST'])
@login_required
def add_route():
    data = request.json
    conn = db.get_db()
    conn.execute('''
        INSERT INTO routes (id, name, start_point, end_point, stops, distance, bus_id, departure, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['id'], data['name'], data.get('start'), data.get('end'), data.get('stops'), data.get('distance'), data.get('busId'), data.get('departure'), data['status']))
    conn.commit()
    conn.close()
    db.log_activity('route', f"Route \"{data['name']}\" created", 'green')
    db.log_notification(None, 'success', f"Route \"{data['name']}\" has been successfully created.")
    return jsonify({'status': 'success'})

@app.route('/api/routes/<id>', methods=['PUT'])
@login_required
def update_route(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE routes SET name=?, start_point=?, end_point=?, stops=?, distance=?, bus_id=?, departure=?, status=? WHERE id=?
    ''', (data['name'], data.get('start'), data.get('end'), data.get('stops'), data.get('distance'), data.get('busId'), data.get('departure'), data['status'], id))
    conn.commit()
    conn.close()
    db.log_activity('route', f"Route \"{data['name']}\" updated", 'green')
    return jsonify({'status': 'success'})

@app.route('/api/routes/<id>', methods=['DELETE'])
@login_required
def delete_route(id):
    conn = db.get_db()
    conn.execute('DELETE FROM routes WHERE id=?', (id,))
    conn.commit()
    conn.close()
    db.log_activity('route', f"Route removed", 'green')
    return jsonify({'status': 'success'})

# --- Drivers ---
@app.route('/api/drivers', methods=['GET'])
@login_required
def get_drivers():
    conn = db.get_db()
    drivers = [dict(r) for r in conn.execute('SELECT * FROM drivers').fetchall()]
    conn.close()
    return jsonify(drivers)

@app.route('/api/drivers', methods=['POST'])
@login_required
def add_driver():
    data = request.json
    conn = db.get_db()
    conn.execute('''
        INSERT INTO drivers (id, name, phone, license_number, license_type, license_expiry, experience, address, bus_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['id'], data['name'], data.get('phone'), data.get('license'), data.get('licenseType'), data.get('licenseExpiry'), data.get('experience'), data.get('address'), data.get('busId'), data['status']))
    conn.commit()
    conn.close()
    db.log_activity('driver', f"Driver {data['name']} registered", 'purple')
    db.log_notification(None, 'success', f"Driver {data['name']} has been registered to the command center.")
    return jsonify({'status': 'success'})

@app.route('/api/drivers/<id>', methods=['PUT'])
@login_required
def update_driver(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE drivers SET name=?, phone=?, license_number=?, license_type=?, license_expiry=?, experience=?, address=?, bus_id=?, status=? WHERE id=?
    ''', (data['name'], data.get('phone'), data.get('license'), data.get('licenseType'), data.get('licenseExpiry'), data.get('experience'), data.get('address'), data.get('busId'), data['status'], id))
    conn.commit()
    conn.close()
    db.log_activity('driver', f"Driver {data['name']} updated", 'purple')
    return jsonify({'status': 'success'})

@app.route('/api/drivers/<id>', methods=['DELETE'])
@login_required
def delete_driver(id):
    conn = db.get_db()
    conn.execute('DELETE FROM drivers WHERE id=?', (id,))
    conn.commit()
    conn.close()
    db.log_activity('driver', f"Driver removed", 'purple')
    return jsonify({'status': 'success'})

# --- Students ---
@app.route('/api/students', methods=['GET'])
@login_required
def get_students():
    conn = db.get_db()
    students = [dict(r) for r in conn.execute('SELECT * FROM students').fetchall()]
    conn.close()
    return jsonify(students)

@app.route('/api/students', methods=['POST'])
@login_required
def add_student():
    data = request.json
    conn = db.get_db()
    conn.execute('''
        INSERT INTO students (id, name, class, phone, parent_name, parent_phone, address, bus_id, route_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['id'], data['name'], data.get('cls'), data.get('phone'), data.get('parent'), data.get('parentPhone'), data.get('address'), data.get('busId'), data.get('routeId')))
    conn.commit()
    conn.close()
    db.log_activity('student', f"Student {data['name']} enrolled", 'pink')
    db.log_notification(None, 'success', f"Student {data['name']} was enrolled in school transportation.")
    return jsonify({'status': 'success'})

@app.route('/api/students/<id>', methods=['PUT'])
@login_required
def update_student(id):
    data = request.json
    conn = db.get_db()
    conn.execute('''
        UPDATE students SET name=?, class=?, phone=?, parent_name=?, parent_phone=?, address=?, bus_id=?, route_id=? WHERE id=?
    ''', (data['name'], data.get('cls'), data.get('phone'), data.get('parent'), data.get('parentPhone'), data.get('address'), data.get('busId'), data.get('routeId'), id))
    conn.commit()
    conn.close()
    db.log_activity('student', f"Student {data['name']} updated", 'pink')
    return jsonify({'status': 'success'})

@app.route('/api/students/<id>', methods=['DELETE'])
@login_required
def delete_student(id):
    conn = db.get_db()
    conn.execute('DELETE FROM students WHERE id=?', (id,))
    conn.commit()
    conn.close()
    db.log_activity('student', f"Student removed", 'pink')
    return jsonify({'status': 'success'})

# --- Utils ---
@app.route('/api/seed', methods=['POST'])
@login_required
def seed_data():
    success = db.seed_db()
    if success:
        return jsonify({'status': 'success', 'message': 'Sample data loaded'})
    else:
        return jsonify({'status': 'error', 'message': 'Database not empty'}), 400

@app.route('/api/clear', methods=['DELETE'])
@login_required
def clear_data():
    db.clear_db()
    return jsonify({'status': 'success'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
