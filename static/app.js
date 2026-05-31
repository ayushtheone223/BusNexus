/* ============================================
   BUSNEXUS — App Logic (API Backend)
   ============================================ */

let DB = { buses: [], drivers: [], students: [], routes: [], activity: [] };

async function loadData() {
  try {
    const res = await fetch('/api/dashboard');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    DB = data;
    updateNavCounts();
    await loadProfile();
  } catch (err) {
    console.error("Failed to fetch data", err);
    showToast("Error loading data from server", "error");
  }
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.status === 'success') {
      const name = data.name || 'User';
      document.getElementById('profileName').textContent = name;
      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('profileInitials').textContent = initials;
    }
  } catch (e) {
    console.error("Error loading profile");
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById('profileMenu');
  if (menu) menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const avatar = document.getElementById('profileAvatar');
  if (avatar && !avatar.contains(e.target)) {
    const menu = document.getElementById('profileMenu');
    if (menu) menu.classList.remove('show');
  }
});

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

function genId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase();
}

// ─── Navigation ───────────────────────────────────────────────
async function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  const navEl  = document.getElementById('nav-' + page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');
  document.getElementById('breadcrumbCurrent').textContent = 
    page.charAt(0).toUpperCase() + page.slice(1);
    
  await loadData();
  renderPage(page);
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(item.dataset.page);
    if (window.innerWidth < 900) closeSidebar();
  });
});

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  else if (page === 'buses') renderBuses();
  else if (page === 'drivers') renderDrivers();
  else if (page === 'students') renderStudents();
  else if (page === 'routes') renderRoutes();
}

// ─── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  // Stats
  animateCount('total-buses', DB.buses.length);
  animateCount('total-drivers', DB.drivers.length);
  animateCount('total-students', DB.students.length);
  animateCount('total-routes', DB.routes.length);

  // Capacity bars
  const capEl = document.getElementById('capacityBars');
  if (DB.buses.length === 0) {
    capEl.innerHTML = `<div class="empty-state-small">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="2" y="7" width="20" height="12" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>
      <p>Add buses to see capacity data</p></div>`;
  } else {
    capEl.innerHTML = DB.buses.slice(0, 6).map(b => {
      const enrolled = DB.students.filter(s => s.bus_id === b.id).length;
      const pct = b.capacity > 0 ? Math.round((enrolled / b.capacity) * 100) : 0;
      const fillClass = pct >= 90 ? 'full' : pct >= 70 ? 'warn' : '';
      return `<div class="cap-item">
        <div class="cap-info">
          <span class="cap-name">${b.number} — ${b.model || 'Bus'}</span>
          <span class="cap-nums">${enrolled} / ${b.capacity} seats</span>
        </div>
        <div class="cap-bar"><div class="cap-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  // Activity
  const actEl = document.getElementById('activityList');
  if (DB.activity.length === 0) {
    actEl.innerHTML = `<div class="empty-state-small">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <p>No activity yet. Start adding data.</p></div>`;
  } else {
    actEl.innerHTML = DB.activity.map(a => `
      <div class="activity-item">
        <div class="act-icon ${a.color}">
          ${activityIcon(a.type)}
        </div>
        <div class="act-info">
          <div class="act-title">${a.message}</div>
          <div class="act-time">${a.created_at}</div>
        </div>
      </div>`).join('');
  }

  // License Status
  const licEl = document.getElementById('licenseStatus');
  if (DB.drivers.length === 0) {
    licEl.innerHTML = `<div class="empty-state-small">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <p>Add drivers to see license status</p></div>`;
  } else {
    const today = new Date();
    licEl.innerHTML = DB.drivers.slice(0, 5).map(d => {
      const exp = new Date(d.license_expiry);
      const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      let badgeClass, badgeText;
      if (diff < 0) { badgeClass = 'expired'; badgeText = 'Expired'; }
      else if (diff <= 60) { badgeClass = 'warn'; badgeText = `${diff}d left`; }
      else { badgeClass = 'ok'; badgeText = 'Valid'; }
      return `<div class="lic-item">
        <div>
          <div class="lic-name">${d.name}</div>
          <div class="lic-expiry">Exp: ${formatDate(d.license_expiry)}</div>
        </div>
        <span class="lic-badge ${badgeClass}">${badgeText}</span>
      </div>`;
    }).join('');
  }
}

function activityIcon(type) {
  const icons = {
    bus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="12" rx="2"/></svg>`,
    driver: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
    student: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/></svg>`,
    route: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/></svg>`,
  };
  return icons[type] || icons.bus;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ─── API Helper ───────────────────────────────────────────────
async function apiCall(url, method, data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (data) options.body = JSON.stringify(data);
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return res.json();
}

// ─── Buses ─────────────────────────────────────────────────────
function renderBuses(filter = '') {
  const tbody = document.getElementById('busTableBody');
  const data = filter ? DB.buses.filter(b =>
    b.number.toLowerCase().includes(filter) ||
    (b.registration || '').toLowerCase().includes(filter) ||
    (b.model || '').toLowerCase().includes(filter)
  ) : DB.buses;

  if (data.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">
      <div class="empty-state">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="7" width="20" height="12" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M2 12h20"/></svg>
        <h3>${filter ? 'No Matching Buses' : 'No Buses Registered'}</h3>
        <p>${filter ? 'Try a different search term' : 'Click "Add Bus" to register your first vehicle'}</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((b, i) => {
    const idx = DB.buses.indexOf(b);
    const enrolled = DB.students.filter(s => s.bus_id === b.id).length;
    const pct = b.capacity > 0 ? Math.round((enrolled / b.capacity) * 100) : 0;
    const fillClass = pct >= 90 ? 'warn' : '';
    const route = DB.routes.find(r => r.id === b.route_id);
    const driver = DB.drivers.find(d => d.id === b.driver_id);
    const statusClass = b.status === 'Active' ? 'badge-active' : b.status === 'Maintenance' ? 'badge-maintenance' : 'badge-inactive';
    return `<tr>
      <td>${b.number}</td>
      <td>${b.registration || '—'}</td>
      <td>${b.model || '—'}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;color:var(--cyan)">${b.capacity}</span></td>
      <td>${enrolled}</td>
      <td>
        <div class="occupancy">
          <div class="occ-bar"><div class="occ-fill ${fillClass}" style="width:${pct}%"></div></div>
          <span class="occ-text">${pct}%</span>
        </div>
      </td>
      <td>${route ? route.name : '—'}</td>
      <td>${driver ? driver.name : '—'}</td>
      <td><span class="badge ${statusClass}">${b.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="editBus('${b.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="confirmDelete('bus', '${b.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function submitBus(e) {
  e.preventDefault();
  const idStr = document.getElementById('busEditIndex').value;
  const bus = {
    id:       idStr !== '-1' ? idStr : genId('BUS'),
    number:   document.getElementById('busNumber').value.trim(),
    reg:      document.getElementById('busReg').value.trim(),
    model:    document.getElementById('busModel').value.trim(),
    capacity: parseInt(document.getElementById('busCapacity').value),
    routeId:  document.getElementById('busRoute').value,
    driverId: document.getElementById('busDriver').value,
    year:     document.getElementById('busYear').value,
    status:   document.getElementById('busStatus').value,
  };
  
  if (idStr !== '-1') {
    await apiCall(`/api/buses/${bus.id}`, 'PUT', bus);
    showToast('Bus updated successfully!', 'success');
  } else {
    await apiCall(`/api/buses`, 'POST', bus);
    showToast('Bus added successfully!', 'success');
  }
  
  closeModal();
  await loadData();
  renderPage(currentPage());
}

function editBus(id) {
  const b = DB.buses.find(x => x.id === id);
  document.getElementById('busEditIndex').value = b.id;
  document.getElementById('busModalTitle').textContent = 'Edit Bus';
  document.getElementById('busNumber').value = b.number;
  document.getElementById('busReg').value    = b.registration || '';
  document.getElementById('busModel').value  = b.model || '';
  document.getElementById('busCapacity').value = b.capacity;
  document.getElementById('busYear').value   = b.year || '';
  document.getElementById('busStatus').value = b.status;
  populateSelects();
  document.getElementById('busRoute').value  = b.route_id || '';
  document.getElementById('busDriver').value = b.driver_id || '';
  openModal('bus');
}

// ─── Routes ────────────────────────────────────────────────────
function renderRoutes(filter = '') {
  const tbody = document.getElementById('routeTableBody');
  const data = filter ? DB.routes.filter(r =>
    r.name.toLowerCase().includes(filter) ||
    (r.start_point || '').toLowerCase().includes(filter) ||
    (r.end_point || '').toLowerCase().includes(filter)
  ) : DB.routes;

  if (data.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">
      <div class="empty-state">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 12h18M3 6h18M3 18h18"/><circle cx="6" cy="6" r="2" fill="currentColor"/><circle cx="18" cy="18" r="2" fill="currentColor"/></svg>
        <h3>${filter ? 'No Matching Routes' : 'No Routes Defined'}</h3>
        <p>${filter ? 'Try a different search term' : 'Click "Add Route" to create your first transportation route'}</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const bus = DB.buses.find(b => b.id === r.bus_id);
    const statusClass = r.status === 'Active' ? 'badge-active' : 'badge-inactive';
    return `<tr>
      <td>${r.id}</td>
      <td style="color:var(--text-primary);font-weight:600">${r.name}</td>
      <td>${r.start_point || '—'}</td>
      <td>${r.end_point || '—'}</td>
      <td><span style="font-family:'JetBrains Mono',monospace;color:var(--purple)">${r.stops || 0}</span></td>
      <td>${r.distance ? r.distance + ' km' : '—'}</td>
      <td>${bus ? bus.number : '—'}</td>
      <td><span class="badge ${statusClass}">${r.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="editRoute('${r.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="confirmDelete('route', '${r.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function submitRoute(e) {
  e.preventDefault();
  const idStr = document.getElementById('routeEditIndex').value;
  const route = {
    id:       idStr !== '-1' ? idStr : genId('RT'),
    name:     document.getElementById('routeName').value.trim(),
    start:    document.getElementById('routeStart').value.trim(),
    end:      document.getElementById('routeEnd').value.trim(),
    stops:    document.getElementById('routeStops').value,
    distance: document.getElementById('routeDistance').value,
    busId:    document.getElementById('routeBus').value,
    departure:document.getElementById('routeDeparture').value,
    status:   document.getElementById('routeStatus').value,
  };
  
  if (idStr !== '-1') {
    await apiCall(`/api/routes/${route.id}`, 'PUT', route);
    showToast('Route updated successfully!', 'success');
  } else {
    await apiCall(`/api/routes`, 'POST', route);
    showToast('Route added successfully!', 'success');
  }
  
  closeModal();
  await loadData();
  renderPage(currentPage());
}

function editRoute(id) {
  const r = DB.routes.find(x => x.id === id);
  document.getElementById('routeEditIndex').value = r.id;
  document.getElementById('routeModalTitle').textContent = 'Edit Route';
  document.getElementById('routeName').value = r.name;
  document.getElementById('routeStart').value = r.start_point || '';
  document.getElementById('routeEnd').value   = r.end_point || '';
  document.getElementById('routeStops').value = r.stops || '';
  document.getElementById('routeDistance').value = r.distance || '';
  document.getElementById('routeDeparture').value = r.departure || '';
  document.getElementById('routeStatus').value = r.status;
  populateSelects();
  document.getElementById('routeBus').value = r.bus_id || '';
  openModal('route');
}

// ─── Drivers ───────────────────────────────────────────────────
function renderDrivers(filter = '') {
  const tbody = document.getElementById('driverTableBody');
  const data = filter ? DB.drivers.filter(d =>
    d.name.toLowerCase().includes(filter) ||
    (d.license_number || '').toLowerCase().includes(filter) ||
    (d.phone || '').toLowerCase().includes(filter)
  ) : DB.drivers;

  if (data.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">
      <div class="empty-state">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        <h3>${filter ? 'No Matching Drivers' : 'No Drivers Registered'}</h3>
        <p>${filter ? 'Try a different search term' : 'Click "Add Driver" to register your first driver'}</p>
      </div></td></tr>`;
    return;
  }

  const today = new Date();
  tbody.innerHTML = data.map(d => {
    const exp = new Date(d.license_expiry);
    const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    let licBadge;
    if (diff < 0) licBadge = `<span class="badge badge-inactive" style="background:rgba(244,63,94,0.15);color:var(--danger)">Expired</span>`;
    else if (diff <= 60) licBadge = `<span class="badge badge-maintenance">${diff}d left</span>`;
    else licBadge = `<span class="badge badge-active">Valid</span>`;
    const bus = DB.buses.find(b => b.id === d.bus_id);
    const statusClass = d.status === 'Active' ? 'badge-active' : d.status === 'On Leave' ? 'badge-leave' : 'badge-inactive';
    return `<tr>
      <td>${d.id}</td>
      <td style="color:var(--text-primary);font-weight:600">${d.name}</td>
      <td>${d.phone || '—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:12px">${d.license_number}</td>
      <td><span style="color:var(--purple);font-weight:600;font-size:12px">${d.license_type || '—'}</span></td>
      <td>${licBadge}</td>
      <td>${d.experience ? d.experience + ' yrs' : '—'}</td>
      <td>${bus ? bus.number : '—'}</td>
      <td><span class="badge ${statusClass}">${d.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="editDriver('${d.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="confirmDelete('driver', '${d.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function submitDriver(e) {
  e.preventDefault();
  const idStr = document.getElementById('driverEditIndex').value;
  const driver = {
    id:           idStr !== '-1' ? idStr : genId('DRV'),
    name:         document.getElementById('driverName').value.trim(),
    phone:        document.getElementById('driverPhone').value.trim(),
    license:      document.getElementById('driverLicense').value.trim(),
    licenseType:  document.getElementById('driverLicenseType').value,
    licenseExpiry:document.getElementById('driverLicenseExpiry').value,
    experience:   document.getElementById('driverExperience').value,
    address:      document.getElementById('driverAddress').value.trim(),
    busId:        document.getElementById('driverBus').value,
    status:       document.getElementById('driverStatus').value,
  };
  
  if (idStr !== '-1') {
    await apiCall(`/api/drivers/${driver.id}`, 'PUT', driver);
    showToast('Driver updated successfully!', 'success');
  } else {
    await apiCall(`/api/drivers`, 'POST', driver);
    showToast('Driver added successfully!', 'success');
  }
  
  closeModal();
  await loadData();
  renderPage(currentPage());
}

function editDriver(id) {
  const d = DB.drivers.find(x => x.id === id);
  document.getElementById('driverEditIndex').value = d.id;
  document.getElementById('driverModalTitle').textContent = 'Edit Driver';
  document.getElementById('driverName').value         = d.name;
  document.getElementById('driverPhone').value        = d.phone || '';
  document.getElementById('driverLicense').value      = d.license_number;
  document.getElementById('driverLicenseType').value  = d.license_type || '';
  document.getElementById('driverLicenseExpiry').value= d.license_expiry;
  document.getElementById('driverExperience').value   = d.experience || '';
  document.getElementById('driverAddress').value      = d.address || '';
  document.getElementById('driverStatus').value       = d.status;
  populateSelects();
  document.getElementById('driverBus').value = d.bus_id || '';
  openModal('driver');
}

// ─── Students ──────────────────────────────────────────────────
function renderStudents(filter = '') {
  const tbody = document.getElementById('studentTableBody');
  const data = filter ? DB.students.filter(s =>
    s.name.toLowerCase().includes(filter) ||
    (s.parent_name || '').toLowerCase().includes(filter) ||
    (s.class || '').toLowerCase().includes(filter)
  ) : DB.students;

  if (data.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">
      <div class="empty-state">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
        <h3>${filter ? 'No Matching Students' : 'No Students Enrolled'}</h3>
        <p>${filter ? 'Try a different search term' : 'Click "Add Student" to enroll your first student'}</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => {
    const bus   = DB.buses.find(b => b.id === s.bus_id);
    const route = DB.routes.find(r => r.id === s.route_id);
    return `<tr>
      <td>${s.id}</td>
      <td style="color:var(--text-primary);font-weight:600">${s.name}</td>
      <td>${s.class || '—'}</td>
      <td>${s.phone || '—'}</td>
      <td>${s.parent_name || '—'}</td>
      <td>${s.parent_phone || '—'}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.address || ''}">${s.address || '—'}</td>
      <td>${bus ? `<span style="color:var(--cyan);font-weight:600">${bus.number}</span>` : '—'}</td>
      <td>${route ? route.name : '—'}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="editStudent('${s.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="confirmDelete('student', '${s.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function submitStudent(e) {
  e.preventDefault();
  const idStr = document.getElementById('studentEditIndex').value;
  const student = {
    id:          idStr !== '-1' ? idStr : genId('STU'),
    name:        document.getElementById('studentName').value.trim(),
    cls:         document.getElementById('studentClass').value.trim(),
    phone:       document.getElementById('studentPhone').value.trim(),
    parent:      document.getElementById('studentParent').value.trim(),
    parentPhone: document.getElementById('studentParentPhone').value.trim(),
    address:     document.getElementById('studentAddress').value.trim(),
    busId:       document.getElementById('studentBus').value,
    routeId:     document.getElementById('studentRoute').value,
  };
  
  if (idStr !== '-1') {
    await apiCall(`/api/students/${student.id}`, 'PUT', student);
    showToast('Student updated successfully!', 'success');
  } else {
    await apiCall(`/api/students`, 'POST', student);
    showToast('Student enrolled successfully!', 'success');
  }
  
  closeModal();
  await loadData();
  renderPage(currentPage());
}

function editStudent(id) {
  const s = DB.students.find(x => x.id === id);
  document.getElementById('studentEditIndex').value = s.id;
  document.getElementById('studentModalTitle').textContent = 'Edit Student';
  document.getElementById('studentName').value        = s.name;
  document.getElementById('studentClass').value       = s.class || '';
  document.getElementById('studentPhone').value       = s.phone || '';
  document.getElementById('studentParent').value      = s.parent_name || '';
  document.getElementById('studentParentPhone').value = s.parent_phone || '';
  document.getElementById('studentAddress').value     = s.address || '';
  populateSelects();
  document.getElementById('studentBus').value   = s.bus_id || '';
  document.getElementById('studentRoute').value = s.route_id || '';
  openModal('student');
}

// ─── Delete ────────────────────────────────────────────────────
function confirmDelete(type, id) {
  const tableMap = { bus: DB.buses, driver: DB.drivers, student: DB.students, route: DB.routes };
  const obj = tableMap[type].find(x => x.id === id);
  if (!obj) return;
  const name = obj.name || obj.number || obj.id;
  
  document.getElementById('deleteMessage').textContent =
    `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteEntry(type, id);
  openModal('delete');
}

async function deleteEntry(type, id) {
  const endpointMap = { bus: 'buses', driver: 'drivers', student: 'students', route: 'routes' };
  const endpoint = endpointMap[type];
  
  await apiCall(`/api/${endpoint}/${id}`, 'DELETE');
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted.`, 'info');
  closeModal();
  await loadData();
  renderPage(currentPage());
}

// ─── Modals ────────────────────────────────────────────────────
let _currentModal = null;

function openModal(type) {
  closeModal();
  populateSelects();
  const modalMap = { bus: 'busModal', driver: 'driverModal', student: 'studentModal', route: 'routeModal', delete: 'deleteModal' };
  const id = modalMap[type] || type;
  const modal = document.getElementById(id);
  if (!modal) return;

  if (type !== 'delete') {
    const form = modal.querySelector('form');
    if (form) {
      const hiddenIdx = form.querySelector('input[type=hidden]');
      if (hiddenIdx && hiddenIdx.value === '-1') form.reset();
    }
  }

  document.getElementById('modalOverlay').classList.add('open');
  requestAnimationFrame(() => modal.classList.add('open'));
  _currentModal = modal;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (_currentModal) {
    _currentModal.classList.remove('open');
    _currentModal = null;
  }
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';

  document.getElementById('busModalTitle').textContent    = 'Add New Bus';
  document.getElementById('driverModalTitle').textContent = 'Add New Driver';
  document.getElementById('routeModalTitle').textContent  = 'Add New Route';
  document.getElementById('studentModalTitle').textContent= 'Add New Student';
  document.getElementById('busEditIndex').value    = '-1';
  document.getElementById('driverEditIndex').value = '-1';
  document.getElementById('routeEditIndex').value  = '-1';
  document.getElementById('studentEditIndex').value= '-1';

  ['busForm','driverForm','routeForm','studentForm'].forEach(fid => {
    const f = document.getElementById(fid);
    if (f) f.reset();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Populate Selects ─────────────────────────────────────────
function populateSelects() {
  const busOpts  = '<option value="">— Select Bus —</option>'  + DB.buses.map(b => `<option value="${b.id}">${b.number}</option>`).join('');
  const routeOpts= '<option value="">— Select Route —</option>'+ DB.routes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  const driverOpts='<option value="">— Select Driver —</option>'+ DB.drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

  ['busRoute', 'studentRoute', 'routeBus', 'driverBus', 'studentBus', 'busDriver'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id.toLowerCase().includes('route')) el.innerHTML = routeOpts;
    else if (id.toLowerCase().includes('driver')) el.innerHTML = driverOpts;
    else el.innerHTML = busOpts;
  });
}

// ─── Filter Tables ─────────────────────────────────────────────
function filterTable(type) {
  const filter = document.getElementById('search' + type.charAt(0).toUpperCase() + type.slice(1))?.value.toLowerCase() || '';
  if (type === 'buses')   renderBuses(filter);
  if (type === 'drivers') renderDrivers(filter);
  if (type === 'students')renderStudents(filter);
  if (type === 'routes')  renderRoutes(filter);
}

// ─── Helpers ───────────────────────────────────────────────────
function currentPage() {
  const active = document.querySelector('.nav-item.active');
  return active ? active.dataset.page : 'dashboard';
}

function updateNavCounts() {
  document.getElementById('nav-bus-count').textContent     = DB.buses.length;
  document.getElementById('nav-driver-count').textContent  = DB.drivers.length;
  document.getElementById('nav-student-count').textContent = DB.students.length;
  document.getElementById('nav-route-count').textContent   = DB.routes.length;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = {
    success: `<svg class="toast-icon success" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg class="toast-icon error" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg class="toast-icon info" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span class="toast-msg">${msg}</span>`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Clock ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('topbarTime').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── Mobile Sidebar ───────────────────────────────────────────
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ─── Sample Data & Clear Data ─────────────────────────────────
async function loadSampleData() {
  if (DB.buses.length > 0 || DB.drivers.length > 0) {
    if (!confirm('This will add sample data alongside your existing data. Continue?')) return;
  }
  await apiCall('/api/seed', 'POST');
  await loadData();
  renderPage(currentPage());
  showToast('Sample data loaded successfully!', 'success');
}

async function clearAllData() {
  if (!confirm('⚠️ This will permanently delete ALL data. Are you absolutely sure?')) return;
  await apiCall('/api/clear', 'DELETE');
  await loadData();
  renderPage(currentPage());
  showToast('All data cleared.', 'info');
}

// ─── CSV Export ────────────────────────────────────────────────
function exportCSV(type) {
  let headers, rows;
  if (type === 'buses') {
    headers = ['Bus No','Registration','Model','Capacity','Status'];
    rows = DB.buses.map(b => [b.number, b.registration||'', b.model||'', b.capacity, b.status]);
  } else if (type === 'drivers') {
    headers = ['ID','Name','Phone','License No','License Type','License Expiry','Experience','Status'];
    rows = DB.drivers.map(d => [d.id, d.name, d.phone||'', d.license_number, d.license_type||'', d.license_expiry, (d.experience||'')+'yrs', d.status]);
  } else if (type === 'students') {
    headers = ['ID','Name','Class','Parent','Parent Phone','Address','Bus','Route'];
    rows = DB.students.map(s => {
      const bus   = DB.buses.find(b => b.id === s.bus_id);
      const route = DB.routes.find(r => r.id === s.route_id);
      return [s.id, s.name, s.class||'', s.parent_name||'', s.parent_phone||'', s.address||'', bus?.number||'', route?.name||''];
    });
  } else if (type === 'routes') {
    headers = ['ID','Name','Start','End','Stops','Distance','Status'];
    rows = DB.routes.map(r => [r.id, r.name, r.start_point||'', r.end_point||'', r.stops||0, (r.distance||'')+'km', r.status]);
  } else return;

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `busnexus_${type}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast(`${type.charAt(0).toUpperCase()+type.slice(1)} exported as CSV!`, 'success');
}

// ─── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderPage('dashboard');
});
