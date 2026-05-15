/* ============================================================
   MedSystem — assets/js/app.js  (Admin Dashboard)
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent      = msg;
  t.style.background = ok ? '#0d1b2a' : '#b91c1c';
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

async function apiFetch(url, opts = {}) {
  try {
    const res  = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { console.error('Non-JSON from ' + url, text.slice(0, 300)); return {}; }
  } catch (err) {
    console.error('Fetch failed:', url, err);
    return {};
  }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function badgeCls(status) {
  return {
    Scheduled: 'b-blue', Pending:  'b-amber', Done:      'b-green',
    Urgent:    'b-red',  Cancelled:'b-gray',  Rejected:  'b-red',
    Admitted:  'b-blue', Critical: 'b-red',   Recovering:'b-green',
    Discharged:'b-gray',
  }[status] ?? 'b-gray';
}

function dotCls(status) {
  return {
    Scheduled: 'sd-blue', Pending:  'sd-amber', Done:      'sd-green',
    Urgent:    'sd-red',  Cancelled:'sd-gray',  Rejected:  'sd-red',
    Admitted:  'sd-blue', Critical: 'sd-red',   Recovering:'sd-green',
    Discharged:'sd-gray',
  }[status] ?? 'sd-gray';
}

function mkBadge(status) {
  return `<span class="badge ${badgeCls(status)}">
    <span class="status-dot ${dotCls(status)}"></span>${esc(status)}
  </span>`;
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* ══════════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════════ */
function nav(el, section) {
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  el.classList.add('active');
  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');

  const fullLabel = el.querySelector('.nav-label-full');
  document.getElementById('page-title').textContent =
    (fullLabel ? fullLabel.textContent : el.textContent).trim().replace(/\d+$/, '').trim();

  if (section === 'dashboard')    { loadStats(); loadActivity(); }
  if (section === 'appointments') loadAppointments();
  if (section === 'patients')     { loadPatients(); loadPatientStats(); }
  if (section === 'doctors')      { loadDoctors(); loadDoctorStats(); }
  if (section === 'wards')        loadWards();
  if (section === 'records')      loadRecords();
  if (section === 'requests')     loadRequests();
}

/* ══════════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* Close modal on backdrop click */
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
});

/* ══════════════════════════════════════════════════════════════
   LOOKUPS  (doctors, departments, wards, patients for dropdowns)
══════════════════════════════════════════════════════════════ */
let _lookup = null;

async function getLookup(forceRefresh = false) {
  if (_lookup && !forceRefresh) return _lookup;
  _lookup = await apiFetch('api/lookup.php');
  return _lookup;
}

function fillSelect(selId, items, valKey, labelKey, placeholder = '— Select —') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    (items ?? []).map(i => `<option value="${i[valKey]}">${esc(i[labelKey])}</option>`).join('');
}

async function populateLookups() {
  const lk = await getLookup();
  fillSelect('apt-doctor', lk.doctors,     'id', 'name', '— Doctor —');
  fillSelect('apt-dept',   lk.departments, 'id', 'name', '— Department —');
  fillSelect('pat-ward',   lk.wards,       'id', 'name', '— Ward —');
  fillSelect('pat-doctor', lk.doctors,     'id', 'name', '— Doctor —');
  fillSelect('doc-dept',   lk.departments, 'id', 'name', '— Department —');
  fillSelect('rec-patient',lk.patients,    'id', 'name', '— Patient —');
  fillSelect('rec-doctor', lk.doctors,     'id', 'name', '— Doctor —');
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD — STATS
══════════════════════════════════════════════════════════════ */
async function loadStats() {
  const data = await apiFetch('api/stats.php');
  if (!data || typeof data !== 'object') return;

  // Total Patients: use patient_stats.php (same source as original Patients tab "Total Patients" card)
  apiFetch('api/patient_stats.php').then(function(ps) {
    if (ps && typeof ps.total !== 'undefined') {
      document.getElementById('st-patients').textContent = ps.total ?? '—';
    }
  });
  document.getElementById('st-beds').textContent     = data.beds_available     ?? '—';
  document.getElementById('st-apts').textContent     = data.appointments_today ?? '—';
  document.getElementById('st-doctors').textContent  = data.total_doctors      ?? '—';

  // Show pending badge if there are pending appointment requests
  const pendingBadge = document.getElementById('st-apts-pending');
  if (pendingBadge) {
    const pending = data.appointments_pending ?? 0;
    if (pending > 0) {
      pendingBadge.textContent = pending + ' pending';
      pendingBadge.style.display = 'inline-block';
    } else {
      pendingBadge.style.display = 'none';
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD — ACTIVITY FEED
══════════════════════════════════════════════════════════════ */
let _activityTimer = null;

async function loadActivity() {
  const el   = document.getElementById('dash-activity');
  const rows = await apiFetch('api/activity.php');
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No recent activity yet.</div>';
    return;
  }

  el.innerHTML = list.map(r => `
    <div class="tbl-row" style="grid-template-columns:160px 1fr 1fr 120px;">
      <span style="color:var(--muted);font-size:12px;">${esc(r.ts ? new Date(r.ts).toLocaleString() : '—')}</span>
      <span style="font-weight:600;color:var(--navy);">${esc(r.description)}</span>
      <span style="color:var(--text-secondary);">${esc(r.detail ?? '')}</span>
      <span>${mkBadge(r.status ?? 'Done')}</span>
    </div>`).join('');

  /* Auto-refresh every 30s */
  clearTimeout(_activityTimer);
  _activityTimer = setTimeout(loadActivity, 30000);
}

/* ══════════════════════════════════════════════════════════════
   APPOINTMENTS
══════════════════════════════════════════════════════════════ */
async function loadAppointments() {
  const el   = document.getElementById('apt-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  const q      = document.getElementById('apt-search')?.value ?? '';
  const date   = document.getElementById('apt-date-filter')?.value ?? '';
  const params = new URLSearchParams({ q, date });
  const rows   = await apiFetch('api/appointments.php?' + params);
  const list   = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No appointments found.</div>';
    return;
  }

  el.innerHTML = list.map(a => `
    <div class="tbl-row" style="grid-template-columns:90px 1.4fr 1.4fr 1fr 120px 110px;">
      <span style="font-weight:600;">${esc(fmtTime(a.time))}</span>
      <span style="font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.patient_name)}</span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.doctor ?? '—')}</span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.type ?? '—')}</span>
      <span>${mkBadge(a.status)}</span>
      <span class="tbl-actions">
        <button class="btn btn-sm" onclick="editAppointment(${JSON.stringify(a).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteAppointment(${a.id})">Del</button>
      </span>
    </div>`).join('');
}

async function saveAppointment() {
  const id = document.getElementById('apt-id').value;
  const payload = {
    id:           id ? +id : undefined,
    patient_name: document.getElementById('apt-patient').value.trim(),
    doctor_id:    document.getElementById('apt-doctor').value || null,
    department_id:document.getElementById('apt-dept').value   || null,
    date:         document.getElementById('apt-date').value,
    time:         document.getElementById('apt-time').value,
    type:         document.getElementById('apt-type').value,
    status:       document.getElementById('apt-status').value,
    notes:        document.getElementById('apt-notes').value.trim(),
  };

  if (!payload.patient_name) return showToast('Patient name is required.', false);
  if (!payload.date)         return showToast('Date is required.', false);

  const method = id ? 'PUT' : 'POST';
  const res    = await apiFetch('api/appointments.php', { method, body: JSON.stringify(payload) });

  if (res.message || res.id) {
    showToast(res.message ?? 'Saved!');
    closeModal('apt-modal');
    loadAppointments();
    loadStats();
    loadPatientStats();
    _lookup = null;
  } else {
    showToast(res.error ?? 'Save failed.', false);
  }
}

function editAppointment(a) {
  document.getElementById('apt-modal-title').textContent = 'Edit Appointment';
  document.getElementById('apt-id').value      = a.id;
  document.getElementById('apt-patient').value = a.patient_name;
  document.getElementById('apt-doctor').value  = a.doctor_id   ?? '';
  document.getElementById('apt-dept').value    = a.department_id ?? '';
  document.getElementById('apt-date').value    = a.date ?? '';
  document.getElementById('apt-time').value    = a.time ?? '';
  document.getElementById('apt-type').value    = a.type ?? 'Consultation';
  document.getElementById('apt-status').value  = a.status ?? 'Scheduled';
  document.getElementById('apt-notes').value   = a.notes ?? '';
  openModal('apt-modal');
}

async function deleteAppointment(id) {
  if (!confirm('Delete this appointment?')) return;
  const res = await apiFetch('api/appointments.php?id=' + id, { method: 'DELETE' });
  if (res.message) { showToast(res.message); loadAppointments(); loadStats(); loadPatientStats(); }
  else showToast(res.error ?? 'Delete failed.', false);
}

function resetAptModal() {
  document.getElementById('apt-modal-title').textContent = 'Schedule Appointment';
  document.getElementById('apt-id').value = '';
  ['apt-patient','apt-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('apt-date').value   = new Date().toISOString().slice(0,10);
  document.getElementById('apt-time').value   = '09:00';
  document.getElementById('apt-type').value   = 'Consultation';
  document.getElementById('apt-status').value = 'Scheduled';
}

/* ══════════════════════════════════════════════════════════════
   PATIENTS — STAT CARDS
══════════════════════════════════════════════════════════════ */
async function loadPatientStats() {
  const data = await apiFetch('api/patient_stats.php');
  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Patients Today: use stats.php (same source as original Dashboard "Patients Today" card)
  apiFetch('api/stats.php').then(function(st) {
    if (st && typeof st.total_patients !== 'undefined') {
      set('pat-st-total', st.total_patients ?? '—');
    }
  });

  if (data && typeof data.total !== 'undefined') {
    set('pat-st-new',      data.new_month);
    set('pat-st-followup', data.followup);
    set('pat-st-apts',     data.apts_today);
  }
}

/* ══════════════════════════════════════════════════════════════
   PATIENTS
══════════════════════════════════════════════════════════════ */
async function loadPatients() {
  const el = document.getElementById('pat-list');
  if (!el) return;
  el.innerHTML = '<div class="loading">Loading…</div>';

  const q    = document.getElementById('pat-search')?.value ?? '';
  const rows = await apiFetch('api/patients.php?q=' + encodeURIComponent(q));
  const list = Array.isArray(rows) ? rows : [];

  loadPatientStats();

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No patients found.</div>';
    return;
  }

  el.innerHTML = list.map(p => `
    <div class="tbl-row" style="grid-template-columns:2fr 50px 1fr 1.5fr 110px 110px;">
      <span style="font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</span>
      <span>${esc(p.age ?? '—')}</span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.ward ?? '—')}</span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.condition ?? '—')}</span>
      <span>${mkBadge(p.status)}</span>
      <span class="tbl-actions">
        <button class="btn btn-sm" onclick="editPatient(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm" onclick="deletePatient(${p.id})">Del</button>
      </span>
    </div>`).join('');
}

async function savePatient() {
  const id = document.getElementById('pat-id').value;
  const payload = {
    id:           id ? +id : undefined,
    first_name:   document.getElementById('pat-fname').value.trim(),
    last_name:    document.getElementById('pat-lname').value.trim(),
    date_of_birth:document.getElementById('pat-dob').value   || null,
    sex:          document.getElementById('pat-sex').value,
    phone:        document.getElementById('pat-phone').value.trim(),
    address:      document.getElementById('pat-address').value.trim(),
    condition:    document.getElementById('pat-condition').value.trim(),
    status:       document.getElementById('pat-status').value,
    ward_id:      document.getElementById('pat-ward').value   || null,
    doctor_id:    document.getElementById('pat-doctor').value || null,
  };

  if (!payload.first_name || !payload.last_name)
    return showToast('First and last name are required.', false);

  const method = id ? 'PUT' : 'POST';
  const res    = await apiFetch('api/patients.php', { method, body: JSON.stringify(payload) });

  if (res.message || res.id) {
    showToast(res.message ?? 'Saved!');
    closeModal('pat-modal');
    loadPatients();
    loadStats();
    loadPatientStats();
    _lookup = null;
  } else {
    showToast(res.error ?? 'Save failed.', false);
  }
}

function editPatient(p) {
  document.getElementById('pat-modal-title').textContent = 'Edit Patient';
  document.getElementById('pat-id').value        = p.id;
  document.getElementById('pat-fname').value     = p.first_name ?? '';
  document.getElementById('pat-lname').value     = p.last_name  ?? '';
  document.getElementById('pat-dob').value       = p.date_of_birth ?? '';
  document.getElementById('pat-sex').value       = p.sex    ?? 'Female';
  document.getElementById('pat-phone').value     = p.phone  ?? '';
  document.getElementById('pat-address').value   = p.address ?? '';
  document.getElementById('pat-condition').value = p.condition ?? '';
  document.getElementById('pat-status').value    = p.status ?? 'Admitted';
  document.getElementById('pat-ward').value      = p.ward_id   ?? '';
  document.getElementById('pat-doctor').value    = p.doctor_id ?? '';
  openModal('pat-modal');
}

async function deletePatient(id) {
  if (!confirm('Delete this patient? This cannot be undone.')) return;
  const res = await apiFetch('api/patients.php?id=' + id, { method: 'DELETE' });
  if (res.message) { showToast(res.message); loadPatients(); loadStats(); loadPatientStats(); _lookup = null; }
  else showToast(res.error ?? 'Delete failed.', false);
}

function resetPatModal() {
  document.getElementById('pat-modal-title').textContent = 'Add New Patient';
  document.getElementById('pat-id').value = '';
  ['pat-fname','pat-lname','pat-dob','pat-phone','pat-address','pat-condition'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('pat-sex').value    = 'Female';
  document.getElementById('pat-status').value = 'Admitted';
}

/* ══════════════════════════════════════════════════════════════
   DOCTORS — STAT BOXES
══════════════════════════════════════════════════════════════ */
const DEPT_ICONS = {
  'Cardiology':       { icon: '❤️', color: '#fee2e2', text: '#dc2626' },
  'Dentist':          { icon: '🦷', color: '#f0fdf4', text: '#16a34a' },
  'Neurology':        { icon: '🧠', color: '#faf5ff', text: '#9333ea' },
  'Pediatrics':       { icon: '👶', color: '#fef9c3', text: '#ca8a04' },
  'Surgery':          { icon: '🔬', color: '#eff6ff', text: '#2563eb' },
  'Emergency':        { icon: '🚨', color: '#fff7ed', text: '#ea580c' },
  'General Medicine': { icon: '🩺', color: '#f0fdfa', text: '#0d9488' },
  'Maternity':        { icon: '🌸', color: '#fdf2f8', text: '#db2777' },
  'Orthopedics':      { icon: '🦴', color: '#f8fafc', text: '#475569' },
  'Radiology':        { icon: '📡', color: '#f0f9ff', text: '#0284c7' },
};

async function loadDoctorStats() {
  const container = document.getElementById('doc-dept-stats');
  if (!container) return;

  const data = await apiFetch('api/doctor_stats.php');
  if (!data || typeof data.total === 'undefined') return;

  const depts = Array.isArray(data.departments) ? data.departments : [];

  // Build ALL box + one box per department
  const allBox = `
    <div class="dash-scard" style="min-width:130px;cursor:pointer;" onclick="filterDoctorsByDept('')">
      <div class="ds-icon" style="background:#e0f2fe;">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="9" cy="8" r="3.5" stroke="#0284c7" stroke-width="1.8"/>
          <circle cx="18" cy="8" r="3.5" stroke="#0284c7" stroke-width="1.8"/>
          <path d="M1 22c0-4.42 3.58-8 8-8" stroke="#0284c7" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M11 22c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#0284c7" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="dash-scard-text">
        <div class="ds-lbl">All Doctors</div>
        <div class="ds-val">${data.total}</div>
      </div>
    </div>`;

  const deptBoxes = depts.map(dep => {
    const style = DEPT_ICONS[dep.department] ?? { icon: '👨‍⚕️', color: '#f1f5f9', text: '#475569' };
    return `
      <div class="dash-scard" style="min-width:130px;cursor:pointer;" onclick="filterDoctorsByDept('${esc(dep.department)}')">
        <div class="ds-icon" style="background:${style.color};font-size:22px;display:flex;align-items:center;justify-content:center;">
          ${style.icon}
        </div>
        <div class="dash-scard-text">
          <div class="ds-lbl">${esc(dep.department)}</div>
          <div class="ds-val">${dep.count}</div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = allBox + deptBoxes;
}

function filterDoctorsByDept(dept) {
  const search = document.getElementById('doc-search');
  if (search) { search.value = dept; loadDoctors(); }
}

/* ══════════════════════════════════════════════════════════════
   DOCTORS
══════════════════════════════════════════════════════════════ */
async function loadDoctors() {
  const el = document.getElementById('doc-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  const q    = document.getElementById('doc-search')?.value ?? '';
  const rows = await apiFetch('api/doctors.php?q=' + encodeURIComponent(q));
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No doctors found.</div>';
    return;
  }

  el.innerHTML = list.map(d => `
    <div class="tbl-row" style="grid-template-columns:2.5fr 1.5fr 80px 110px 110px;">
      <span style="display:flex;align-items:center;gap:10px;min-width:0;overflow:hidden;">
        <span class="doc-av" style="flex-shrink:0;">${esc(d.initials ?? '??')}</span>
        <span style="font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Dr. ${esc(d.name)}</span>
      </span>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.department ?? '—')}</span>
      <span>${esc(d.patient_count ?? 0)} pts</span>
      <span>${mkBadge(d.status)}</span>
      <span class="tbl-actions">
        <button class="btn btn-sm" onclick="editDoctor(${JSON.stringify(d).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-red btn-sm" onclick="deleteDoctor(${d.id})">Del</button>
      </span>
    </div>`).join('');
}

async function saveDoctor() {
  const id = document.getElementById('doc-id').value;
  const payload = {
    id:            id ? +id : undefined,
    first_name:    document.getElementById('doc-fname').value.trim(),
    last_name:     document.getElementById('doc-lname').value.trim(),
    department_id: document.getElementById('doc-dept').value  || null,
    year_started:  document.getElementById('doc-year').value  || null,
    status:        document.getElementById('doc-status').value,
  };

  if (!payload.first_name || !payload.last_name)
    return showToast('First and last name are required.', false);

  const method = id ? 'PUT' : 'POST';
  const res    = await apiFetch('api/doctors.php', { method, body: JSON.stringify(payload) });

  if (res.message || res.id) {
    showToast(res.message ?? 'Saved!');
    closeModal('doc-modal');
    loadDoctors();
    loadDoctorStats();
    _lookup = null;
  } else {
    showToast(res.error ?? 'Save failed.', false);
  }
}

function editDoctor(d) {
  document.getElementById('doc-modal-title').textContent = 'Edit Doctor';
  document.getElementById('doc-id').value     = d.id;
  document.getElementById('doc-fname').value  = d.first_name ?? '';
  document.getElementById('doc-lname').value  = d.last_name  ?? '';
  document.getElementById('doc-dept').value   = d.department_id ?? '';
  document.getElementById('doc-year').value   = d.year_started  ?? '';
  document.getElementById('doc-status').value = d.status ?? 'On duty';
  openModal('doc-modal');
}

async function deleteDoctor(id) {
  if (!confirm('Delete this doctor?')) return;
  const res = await apiFetch('api/doctors.php?id=' + id, { method: 'DELETE' });
  if (res.message) { showToast(res.message); loadDoctors(); loadDoctorStats(); _lookup = null; }
  else showToast(res.error ?? 'Delete failed.', false);
}

/* ══════════════════════════════════════════════════════════════
   WARDS
══════════════════════════════════════════════════════════════ */
async function loadWards() {
  const el   = document.getElementById('ward-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  const rows = await apiFetch('api/wards.php');
  const list = Array.isArray(rows) ? rows : [];

  /* Update summary cards */
  const totalAvail = list.reduce((s, w) => s + (+w.available), 0);
  const totalOcc   = list.reduce((s, w) => s + (+w.occupied),  0);
  const el1 = document.getElementById('wst-avail');
  const el2 = document.getElementById('wst-occ');
  const el3 = document.getElementById('wst-wards');
  if (el1) el1.textContent = totalAvail;
  if (el2) el2.textContent = totalOcc;
  if (el3) el3.textContent = list.length;

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No wards found.</div>';
    return;
  }

  el.innerHTML = list.map(w => {
    const pct = w.capacity > 0 ? Math.round((w.occupied / w.capacity) * 100) : 0;
    return `
    <div class="tbl-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr;">
      <span style="font-weight:600;color:var(--navy);">${esc(w.name)}</span>
      <span>${esc(w.capacity)}</span>
      <span>${esc(w.occupied)}</span>
      <span>${esc(w.available)}</span>
      <span>${mkBadge(w.status)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   MEDICAL RECORDS
══════════════════════════════════════════════════════════════ */
async function loadRecords() {
  const el = document.getElementById('rec-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  const q    = document.getElementById('rec-search')?.value ?? '';
  const rows = await apiFetch('api/records.php?q=' + encodeURIComponent(q));
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No records found.</div>';
    return;
  }

  el.innerHTML = list.map(r => {
    const statusBadge = r.status === 'Pending'
      ? '<span style="background:#fef3c7;color:#b45309;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">Pending</span>'
      : '<span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;">Done</span>';
    const sourceTag = r.source === 'patient_admitted'
      ? '<span style="background:#ede9fe;color:#5b21b6;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:4px;">Admitted</span>'
      : r.source === 'appointment'
      ? '<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:4px;">Appointment</span>'
      : '';
    return `
    <div class="tbl-row" style="grid-template-columns:1.4fr 2fr 1fr 1fr 1fr 90px;cursor:pointer;" onclick="editRecord(${r.id},'${esc(r.patient)}','${esc(r.diagnosis)}','${esc(r.notes??'')}','${r.record_date}','${r.status}',${r.patient_id},${r.doctor_id??'null'})">
      <span style="font-weight:600;color:var(--navy);">${esc(r.patient)}</span>
      <span>${esc(r.diagnosis)}${sourceTag}</span>
      <span>${esc(r.doctor ?? '—')}</span>
      <span style="color:var(--muted);font-size:12px;">${formatRecDate(r.record_date)}</span>
      <span>${statusBadge}</span>
      <span class="tbl-actions" onclick="event.stopPropagation()">
        <button class="btn btn-red btn-sm" onclick="deleteRecord(${r.id})">Del</button>
      </span>
    </div>`;
  }).join('');
}

function formatRecDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

async function editRecord(id, patient, diagnosis, notes, date, status, patientId, doctorId) {
  document.getElementById('rec-modal-title').textContent = 'Edit Medical Record';
  document.getElementById('rec-edit-id').value   = id;
  document.getElementById('rec-diagnosis').value = diagnosis;
  document.getElementById('rec-notes').value     = notes;
  document.getElementById('rec-date').value      = date;
  document.getElementById('rec-status').value    = status ?? 'Pending';

  // Re-fetch lookups so newly added patients/doctors appear in dropdowns
  const lk = await getLookup(true); // force fresh fetch
  fillSelect('rec-patient', lk.patients, 'id', 'name', '— Patient —');
  fillSelect('rec-doctor',  lk.doctors,  'id', 'name', '— Doctor —');

  const pSel = document.getElementById('rec-patient');
  const dSel = document.getElementById('rec-doctor');
  if (patientId) pSel.value = patientId;
  if (doctorId)  dSel.value = doctorId;

  openModal('rec-modal');
}

async function saveRecord() {
  const editId = document.getElementById('rec-edit-id').value;
  const payload = {
    patient_id:  document.getElementById('rec-patient').value   || null,
    doctor_id:   document.getElementById('rec-doctor').value    || null,
    diagnosis:   document.getElementById('rec-diagnosis').value.trim(),
    notes:       document.getElementById('rec-notes').value.trim(),
    record_date: document.getElementById('rec-date').value,
    status:      document.getElementById('rec-status').value    || 'Pending',
  };

  if (!payload.diagnosis)   return showToast('Diagnosis is required.', false);
  if (!payload.patient_id)  return showToast('Please select a patient.', false);

  const url    = editId ? 'api/records.php?id=' + editId : 'api/records.php';
  const method = editId ? 'PUT' : 'POST';
  const res    = await apiFetch(url, { method, body: JSON.stringify(payload) });

  if (res.message || res.id) {
    showToast(res.message ?? (editId ? 'Record updated!' : 'Record saved!'));
    closeModal('rec-modal');
    document.getElementById('rec-edit-id').value = '';
    document.getElementById('rec-modal-title').textContent = 'Add Medical Record';
    loadRecords();
  } else {
    showToast(res.error ?? 'Save failed.', false);
  }
}

async function deleteRecord(id) {
  if (!confirm('Delete this medical record?')) return;
  const res = await apiFetch('api/records.php?id=' + id, { method: 'DELETE' });
  if (res.message) { showToast(res.message); loadRecords(); }
  else showToast(res.error ?? 'Delete failed.', false);
}

/* ══════════════════════════════════════════════════════════════
   APPOINTMENT REQUESTS
══════════════════════════════════════════════════════════════ */
async function loadRequests() {
  const el = document.getElementById('req-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  const q      = document.getElementById('req-search')?.value ?? '';
  const status = document.getElementById('req-filter')?.value ?? 'Pending';
  const params = new URLSearchParams({ q, status });
  const rows   = await apiFetch('api/appointments.php?' + params);
  const list   = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    el.innerHTML = '<div class="empty-state">No requests found.</div>';
    return;
  }

  el.innerHTML = list.map(a => `
    <div class="tbl-row" style="grid-template-columns:1.5fr 1fr 1fr 1fr 1fr 110px 160px;">
      <span style="font-weight:600;color:var(--navy);">${esc(a.patient_name)}</span>
      <span>${esc(a.doctor ?? '—')}</span>
      <span>${esc(a.date_fmt ?? a.date ?? '—')}</span>
      <span>${esc(fmtTime(a.time))}</span>
      <span>${esc(a.type ?? '—')}</span>
      <span>${mkBadge(a.status)}</span>
      <span class="tbl-actions">
        ${a.status === 'Pending' ? `
          <button class="btn btn-blue btn-sm" onclick="approveRequest(${a.id})">Approve</button>
          <button class="btn btn-red btn-sm"  onclick="openReject(${a.id})">Reject</button>
        ` : '—'}
      </span>
    </div>`).join('');

  /* Update sidebar badge */
  updateReqBadge();
}

async function approveRequest(id) {
  const res = await apiFetch('api/approve.php', {
    method: 'POST',
    body: JSON.stringify({ id, action: 'approve' }),
  });
  if (res.message) {
    showToast(res.message);
    loadRequests();
    updateReqBadge();
    loadStats();
    loadPatientStats();
    loadActivity();
    /* If the Appointments tab is currently visible, refresh it too */
    if (document.getElementById('sec-appointments')?.classList.contains('active')) {
      loadAppointments();
    }
  } else {
    showToast(res.error ?? 'Failed.', false);
  }
}

function openReject(id) {
  document.getElementById('reject-apt-id').value  = id;
  document.getElementById('reject-reason').value  = '';
  openModal('reject-modal');
}

async function confirmReject() {
  const id     = document.getElementById('reject-apt-id').value;
  const reason = document.getElementById('reject-reason').value.trim();
  const res    = await apiFetch('api/approve.php', {
    method: 'POST',
    body: JSON.stringify({ id: +id, action: 'reject', reason }),
  });
  if (res.message) {
    showToast(res.message);
    closeModal('reject-modal');
    loadRequests();
    updateReqBadge();
    loadStats();
    loadPatientStats();
    loadActivity();
    if (document.getElementById('sec-appointments')?.classList.contains('active')) {
      loadAppointments();
    }
  } else {
    showToast(res.error ?? 'Failed.', false);
  }
}

async function updateReqBadge() {
  const data  = await apiFetch('api/appointments.php?pending_count=1');
  const badge = document.getElementById('req-badge');
  const count = data.count ?? 0;
  if (badge) {
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
  // Keep stat card in sync with badge
  loadStats();
}

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await populateLookups();
  loadStats();
  loadActivity();
  updateReqBadge();
  loadPatientStats(); // loads patient stat boxes independently

  // Auto-refresh stats and request badge every 30 seconds
  setInterval(() => {
    loadStats();
    updateReqBadge();
  }, 30000);

  // Also refresh activity feed every 60 seconds
  setInterval(() => {
    loadActivity();
  }, 60000);

  /* Wire up search debouncing */
  const searches = [
    ['apt-search',  loadAppointments],
    ['pat-search',  loadPatients],
    ['doc-search',  loadDoctors],
    ['rec-search',  loadRecords],
    ['req-search',  loadRequests],
  ];
  searches.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', debounce(fn, 400));
  });

  /* Date filter for appointments */
  const dateFilter = document.getElementById('apt-date-filter');
  if (dateFilter) dateFilter.addEventListener('change', loadAppointments);

  /* Reset modals on open */
  document.querySelector('[onclick="openModal(\'apt-modal\')"]')
    ?.addEventListener('click', resetAptModal);
  document.querySelector('[onclick="openModal(\'pat-modal\')"]')
    ?.addEventListener('click', resetPatModal);
});