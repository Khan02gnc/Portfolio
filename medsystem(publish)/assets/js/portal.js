/* ============================================================
   MedSystem — assets/js/portal.js  (Patient Portal ONLY)
   APIs used:
     GET    api/my_appointments.php          → list own appointments
     POST   api/my_appointments.php          → book appointment
     DELETE api/my_appointments.php?id=N     → cancel appointment
     GET    api/doctors.php                  → doctor list
     GET    api/lookup.php                   → departments
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
  t.style.background = ok ? '#111827' : '#b91c1c';
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { console.error('Non-JSON from ' + url, text.slice(0, 200)); return {}; }
  } catch (err) {
    console.error('Fetch failed:', url, err);
    return {};
  }
}

/* Maps status → CSS badge class (matches portal.css exactly) */
function badgeCls(status) {
  return {
    Pending:   'b-amber',
    Scheduled: 'b-blue',
    Done:      'b-green',
    Cancelled: 'b-gray',
    Rejected:  'b-red',
    Urgent:    'b-red',
  }[status] ?? 'b-gray';
}

function dotCls(status) {
  return {
    Pending:   'sd-amber',
    Scheduled: 'sd-blue',
    Done:      'sd-green',
    Cancelled: 'sd-gray',
    Rejected:  'sd-red',
    Urgent:    'sd-red',
  }[status] ?? 'sd-gray';
}

function mkBadge(status) {
  return `<span class="badge ${badgeCls(status)}">
    <span class="status-dot ${dotCls(status)}"></span>
    ${esc(status)}
  </span>`;
}

/* ══════════════════════════════════════════════════════════════
   NAV  — this is the function portal.php calls on every tab click
══════════════════════════════════════════════════════════════ */
function pnav(el, section) {
  /* deactivate all nav items and sections */
  document.querySelectorAll('.pnav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.psection').forEach(s => s.classList.remove('active'));

  /* activate clicked tab and matching section */
  el.classList.add('active');
  const sec = document.getElementById('psec-' + section);
  if (sec) sec.classList.add('active');

  /* lazy-load content for each tab */
  if (section === 'book')    initBook();
  if (section === 'history') loadHistory();
  if (section === 'doctors') loadDocGrid();
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW  —  GET api/my_appointments.php
   Returns a plain array of appointment rows.
══════════════════════════════════════════════════════════════ */
async function loadOverview() {
  try {
    const rows = await apiFetch('api/my_appointments.php');
    const list = Array.isArray(rows) ? rows : [];

    /* Build stat counts from the list */
    const stats = {};
    list.forEach(a => { stats[a.status] = (stats[a.status] ?? 0) + 1; });

    document.getElementById('ov-pending').textContent   = stats.Pending   ?? 0;
    document.getElementById('ov-scheduled').textContent = stats.Scheduled ?? 0;
    document.getElementById('ov-done').textContent      = stats.Done      ?? 0;

    /* Pending badge on nav tab */
    const badge  = document.getElementById('pending-badge');
    const pCount = stats.Pending ?? 0;
    badge.textContent   = pCount;
    badge.style.display = pCount > 0 ? 'inline-block' : 'none';

    /* Recent 5 rows */
    const el     = document.getElementById('ov-list');
    const recent = list.slice(0, 5);

    if (!recent.length) {
      el.innerHTML = `<div class="empty-state">
        No appointments yet.
        <a href="#" style="color:#2563eb;font-weight:600;text-decoration:none;"
           onclick="pnav(document.querySelector('[onclick*=book]'),\'book\');return false;">
          Book your first appointment →
        </a>
      </div>`;
      return;
    }

    el.innerHTML = recent.map(a => `
      <div class="tbl-row" style="grid-template-columns:1.2fr 1fr 1fr 1fr 110px;">
        <span style="font-weight:600;color:#111827;">${esc(a.date_fmt ?? a.date ?? '—')}</span>
        <span>${esc(a.doctor ?? '—')}</span>
        <span>${esc(a.department ?? '—')}</span>
        <span>${esc(a.type ?? '—')}</span>
        <span>${mkBadge(a.status)}</span>
      </div>`).join('');

  } catch (e) {
    document.getElementById('ov-list').innerHTML =
      '<div class="empty-state" style="color:#b91c1c;">Failed to load. Please refresh.</div>';
  }
}

/* ══════════════════════════════════════════════════════════════
   BOOK APPOINTMENT
   Doctors      → GET api/doctors.php
   Departments  → GET api/lookup.php
   Submit       → POST api/my_appointments.php
══════════════════════════════════════════════════════════════ */
let _bookReady = false;
let _allDoctors = [];

async function initBook() {
  if (_bookReady) return;

  try {
    /* Fetch doctors and departments in parallel */
    const [docRows, lookup] = await Promise.all([
      apiFetch('api/doctors.php'),
      apiFetch('api/lookup.php'),
    ]);

    /* doctors.php returns array of {id, name, department, department_id, status, ...} */
    _allDoctors = Array.isArray(docRows) ? docRows : [];

    const dsel    = document.getElementById('bk-doctor');
    const deptSel = document.getElementById('bk-dept');

    /* Populate doctor dropdown */
    dsel.innerHTML = '<option value="">— Select a doctor —</option>' +
      _allDoctors.map(d =>
        `<option value="${d.id}" data-dept-id="${d.department_id ?? ''}" data-dept-name="${esc(d.department ?? '')}">
          ${esc(d.name)}${d.department ? ' · ' + esc(d.department) : ''}
        </option>`
      ).join('');

    /* Populate department dropdown from lookup.php */
    const depts = Array.isArray(lookup.departments) ? lookup.departments : [];
    deptSel.innerHTML = '<option value="">— Select department —</option>' +
      depts.map(dep => `<option value="${dep.id}">${esc(dep.name)}</option>`).join('');

    /* When doctor changes → auto-select their department */
    dsel.addEventListener('change', () => {
      const opt    = dsel.selectedOptions[0];
      const deptId = opt?.dataset?.deptId ?? '';
      if (deptId) deptSel.value = deptId;
    });

    /* When department changes → filter doctor list */
    deptSel.addEventListener('change', () => {
      const deptId   = deptSel.value;
      const prevDoc  = dsel.value;

      dsel.innerHTML = '<option value="">— Select a doctor —</option>' +
        _allDoctors
          .filter(d => !deptId || String(d.department_id) === String(deptId))
          .map(d =>
            `<option value="${d.id}" data-dept-id="${d.department_id ?? ''}" data-dept-name="${esc(d.department ?? '')}">
              ${esc(d.name)}${d.department ? ' · ' + esc(d.department) : ''}
            </option>`
          ).join('');

      /* Restore selection if still in filtered list */
      if (prevDoc) dsel.value = prevDoc;
    });

    _bookReady = true;

  } catch (e) {
    showToast('Could not load doctors. Please refresh.', false);
  }
}

async function submitBooking() {
  const doctorId = document.getElementById('bk-doctor').value;
  const deptId   = document.getElementById('bk-dept').value;
  const date     = document.getElementById('bk-date').value;
  const time     = document.getElementById('bk-time').value;
  const type     = document.getElementById('bk-type').value;
  const notes    = document.getElementById('bk-notes').value.trim();

  /* Validation */
  if (!doctorId) return showToast('Please select a doctor.', false);
  if (!date)     return showToast('Please choose a date.', false);
  if (!time)     return showToast('Please choose a time.', false);

  const [h] = time.split(':').map(Number);
  if (h < 8 || h >= 17) return showToast('Clinic hours are 8:00 AM – 5:00 PM only.', false);

  const btn = document.querySelector('#psec-book .btn-blue');
  btn.disabled    = true;
  btn.textContent = 'Submitting…';

  try {
    const res = await apiFetch('api/my_appointments.php', {
      method: 'POST',
      body: JSON.stringify({
        doctor_id:     doctorId,
        department_id: deptId || null,
        date,
        time,
        type,
        notes,
      }),
    });

    if (res.id || res.message) {
      showToast('✓ Appointment request submitted! Staff will confirm it shortly.');
      /* Reset form */
      document.getElementById('bk-doctor').value = '';
      document.getElementById('bk-dept').value   = '';
      document.getElementById('bk-notes').value  = '';
      /* Refresh counts then jump to My Appointments */
      loadOverview();
      setTimeout(() => pnav(document.querySelector('[onclick*=history]'), 'history'), 1400);
    } else {
      showToast(res.error ?? 'Booking failed. Please try again.', false);
    }
  } catch {
    showToast('Network error. Please try again.', false);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Request';
  }
}

/* ══════════════════════════════════════════════════════════════
   MY APPOINTMENTS  —  GET api/my_appointments.php
══════════════════════════════════════════════════════════════ */
async function loadHistory() {
  const filter = document.getElementById('hist-filter')?.value ?? '';
  const el     = document.getElementById('hist-list');
  el.innerHTML = '<div class="loading">Loading…</div>';

  try {
    const rows = await apiFetch('api/my_appointments.php');
    const list = Array.isArray(rows) ? rows : [];

    /* Client-side filter (my_appointments.php returns all own rows) */
    const filtered = filter ? list.filter(a => a.status === filter) : list;

    if (!filtered.length) {
      el.innerHTML = '<div class="empty-state">No appointments found.</div>';
      return;
    }

    el.innerHTML = filtered.map(a => `
      <div class="tbl-row" style="grid-template-columns:1.3fr 1fr 1fr 1fr 120px 90px;">
        <span>
          <span style="font-weight:600;color:#111827;">${esc(a.date_fmt ?? a.date ?? '—')}</span>
          ${a.time ? `<br><small style="color:#9ca3af;font-size:11px;">${esc(a.time)}</small>` : ''}
        </span>
        <span>${esc(a.doctor ?? '—')}</span>
        <span>${esc(a.department ?? '—')}</span>
        <span>${esc(a.type ?? '—')}</span>
        <span>
          ${mkBadge(a.status)}
          ${a.rejection_reason
            ? `<br><small style="color:#b91c1c;font-size:10px;display:block;margin-top:2px;"
                title="${esc(a.rejection_reason)}">
                ${esc(a.rejection_reason.length > 34
                  ? a.rejection_reason.slice(0, 34) + '…'
                  : a.rejection_reason)}
               </small>`
            : ''}
        </span>
        <span>
          ${(a.status === 'Pending' || a.status === 'Scheduled')
            ? `<button class="btn btn-red btn-sm" onclick="openCancel(${a.id})">Cancel</button>`
            : ''}
        </span>
      </div>`).join('');

  } catch {
    el.innerHTML = '<div class="empty-state" style="color:#b91c1c;">Failed to load. Please refresh.</div>';
  }
}

/* ══════════════════════════════════════════════════════════════
   CANCEL MODAL  —  .modal-bg.open  (matches portal.css)
══════════════════════════════════════════════════════════════ */
let _cancelId = null;

function openCancel(id) {
  _cancelId = id;
  document.getElementById('cancel-modal').classList.add('open');
}

function closeCancel() {
  _cancelId = null;
  document.getElementById('cancel-modal').classList.remove('open');
}

async function confirmCancel() {
  if (!_cancelId) return;
  const id = _cancelId;
  closeCancel();

  try {
    const res = await apiFetch(`api/my_appointments.php?id=${id}`, { method: 'DELETE' });
    if (res.message) {
      showToast('Appointment cancelled.');
      loadHistory();
      loadOverview();
    } else {
      showToast(res.error ?? 'Could not cancel.', false);
    }
  } catch {
    showToast('Network error.', false);
  }
}

/* Close modal when clicking the backdrop */
document.getElementById('cancel-modal').addEventListener('click', function (e) {
  if (e.target === this) closeCancel();
});

/* ══════════════════════════════════════════════════════════════
   OUR DOCTORS  —  GET api/doctors.php
   doctors.php returns: {id, name, department, status, initials, patient_count, year_started}
══════════════════════════════════════════════════════════════ */
let _docGridReady = false;

async function loadDocGrid() {
  if (_docGridReady) return;
  const el = document.getElementById('doc-grid');

  try {
    const rows = await apiFetch('api/doctors.php');
    const docs  = Array.isArray(rows) ? rows : [];

    if (!docs.length) {
      el.innerHTML = '<div class="empty-state">No doctors listed yet.</div>';
      return;
    }

    el.innerHTML = docs.map(d => `
      <div class="doc-card">
        <div class="doc-av">${esc(d.initials ?? (d.name ?? 'Dr').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase())}</div>
        <div class="doc-name">Dr. ${esc(d.name ?? '—')}</div>
        <div class="doc-dept">${esc(d.department ?? 'General Medicine')}</div>
        <div class="doc-status" style="margin-top:8px;">
          <span class="badge ${d.status === 'On duty' ? 'b-green' : d.status === 'In surgery' ? 'b-amber' : 'b-gray'}">
            <span class="status-dot ${d.status === 'On duty' ? 'sd-green' : d.status === 'In surgery' ? 'sd-amber' : 'sd-gray'}"></span>
            ${esc(d.status ?? 'On duty')}
          </span>
        </div>
        <button class="btn btn-blue btn-sm" style="margin-top:10px;width:100%;"
          onclick="bookWithDoctor('${d.id}', '${d.department_id ?? ''}')">
          Book Appointment
        </button>
      </div>`).join('');

    _docGridReady = true;

  } catch {
    el.innerHTML = '<div class="empty-state" style="color:#b91c1c;">Failed to load doctors.</div>';
  }
}

function bookWithDoctor(docId, deptId) {
  /* Switch to Book tab, then pre-select the doctor */
  pnav(document.querySelector('[onclick*=book]'), 'book');
  setTimeout(() => {
    const dsel    = document.getElementById('bk-doctor');
    const deptSel = document.getElementById('bk-dept');
    if (dsel)    { dsel.value = docId;    dsel.dispatchEvent(new Event('change')); }
    if (deptSel && deptId) deptSel.value = deptId;
  }, 300);
}

/* ══════════════════════════════════════════════════════════════
   INIT  — load overview on page ready
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', loadOverview);