// All requests go to a relative "/api" prefix. In the cluster, your
// Ingress should route that path prefix to the backend Service (port 3000),
// while "/" is routed to this frontend's Service (nginx, port 80).
// That means this file never needs to know the backend's actual host.
const API_BASE = '/api';

const state = {
  students: [],
  teachers: [],
  classes: [],
  enrollments: [],
};

// ---------- helpers ----------

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function showToast(message, type = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  el.className = `toast ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 4000);
}

function fullName(p) {
  return `${p.first_name} ${p.last_name}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

// ---------- view switching ----------

const views = ['dashboard', 'students', 'teachers', 'classes', 'enrollments'];
const titles = {
  dashboard: ['Dashboard', 'An overview of the current term.'],
  students: ['Students', 'Manage the student roster.'],
  teachers: ['Teachers', 'Manage teaching staff.'],
  classes: ['Classes', 'Manage classes and assign teachers.'],
  enrollments: ['Enrollments', 'Link students to classes.'],
};

function setView(view) {
  views.forEach((v) => {
    document.getElementById(`view-${v}`).classList.toggle('is-active', v === view);
  });
  document.querySelectorAll('.rail-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === view);
  });
  const [title, subtitle] = titles[view];
  document.getElementById('view-title').textContent = title;
  document.getElementById('view-subtitle').textContent = subtitle;
}

document.getElementById('nav-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.rail-tab');
  if (!btn) return;
  setView(btn.dataset.view);
});

// ---------- API status ----------

async function checkApiStatus() {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  try {
    await api('/ready');
    dot.className = 'status-dot ok';
    text.textContent = 'API connected';
  } catch (err) {
    dot.className = 'status-dot fail';
    text.textContent = 'API unreachable';
  }
}

// ---------- load all data ----------

async function loadAll() {
  try {
    const [students, teachers, classes, enrollments] = await Promise.all([
      api('/students'),
      api('/teachers'),
      api('/classes'),
      api('/enrollments'),
    ]);
    state.students = students;
    state.teachers = teachers;
    state.classes = classes;
    state.enrollments = enrollments;
    renderDashboard();
    renderStudents();
    renderTeachers();
    renderClasses();
    renderEnrollments();
    populateSelects();
  } catch (err) {
    showToast(`Could not load data: ${err.message}`, 'error');
  }
}

// ---------- dashboard ----------

function renderDashboard() {
  document.getElementById('stat-students').textContent = state.students.length;
  document.getElementById('stat-teachers').textContent = state.teachers.length;
  document.getElementById('stat-classes').textContent = state.classes.length;
  document.getElementById('stat-enrollments').textContent = state.enrollments.length;

  const tbody = document.getElementById('dashboard-recent');
  const rows = state.enrollments.slice(0, 6);
  tbody.innerHTML = rows.length
    ? rows.map((e) => `
        <tr>
          <td>${e.student_first_name} ${e.student_last_name}</td>
          <td>${e.class_name}</td>
          <td>${fmtDate(e.enrolled_at)}</td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="3">No enrollments yet.</td></tr>`;
}

// ---------- students ----------

function renderStudents() {
  const tbody = document.getElementById('students-table');
  tbody.innerHTML = state.students.length
    ? state.students.map((s) => `
        <tr>
          <td>${fullName(s)}</td>
          <td>${s.email}</td>
          <td>${s.guardian_name || '—'}</td>
          <td>${fmtDate(s.date_of_birth)}</td>
          <td class="row-actions">
            <button data-edit-student="${s.id}">Edit</button>
            <button class="danger" data-delete-student="${s.id}">Delete</button>
          </td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="5">No students yet — add the first one above.</td></tr>`;
}

const studentForm = document.getElementById('form-student');
studentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(studentForm);
  const id = fd.get('id');
  const payload = {
    first_name: fd.get('first_name'),
    last_name: fd.get('last_name'),
    email: fd.get('email'),
    date_of_birth: fd.get('date_of_birth') || null,
    guardian_name: fd.get('guardian_name') || null,
    guardian_phone: fd.get('guardian_phone') || null,
  };
  try {
    if (id) {
      await api(`/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Student updated', 'success');
    } else {
      await api('/students', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Student added', 'success');
    }
    resetForm(studentForm);
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('students-table').addEventListener('click', async (e) => {
  const editId = e.target.dataset.editStudent;
  const delId = e.target.dataset.deleteStudent;
  if (editId) {
    const s = state.students.find((x) => String(x.id) === editId);
    fillForm(studentForm, s);
  }
  if (delId) {
    if (!confirm('Delete this student? This also removes their enrollments.')) return;
    try {
      await api(`/students/${delId}`, { method: 'DELETE' });
      showToast('Student deleted', 'success');
      await loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ---------- teachers ----------

function renderTeachers() {
  const tbody = document.getElementById('teachers-table');
  tbody.innerHTML = state.teachers.length
    ? state.teachers.map((t) => `
        <tr>
          <td>${fullName(t)}</td>
          <td>${t.subject || '—'}</td>
          <td>${t.email}</td>
          <td>${t.phone || '—'}</td>
          <td class="row-actions">
            <button data-edit-teacher="${t.id}">Edit</button>
            <button class="danger" data-delete-teacher="${t.id}">Delete</button>
          </td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="5">No teachers yet — add the first one above.</td></tr>`;
}

const teacherForm = document.getElementById('form-teacher');
teacherForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(teacherForm);
  const id = fd.get('id');
  const payload = {
    first_name: fd.get('first_name'),
    last_name: fd.get('last_name'),
    email: fd.get('email'),
    subject: fd.get('subject') || null,
    phone: fd.get('phone') || null,
  };
  try {
    if (id) {
      await api(`/teachers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Teacher updated', 'success');
    } else {
      await api('/teachers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Teacher added', 'success');
    }
    resetForm(teacherForm);
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('teachers-table').addEventListener('click', async (e) => {
  const editId = e.target.dataset.editTeacher;
  const delId = e.target.dataset.deleteTeacher;
  if (editId) {
    const t = state.teachers.find((x) => String(x.id) === editId);
    fillForm(teacherForm, t);
  }
  if (delId) {
    if (!confirm('Delete this teacher?')) return;
    try {
      await api(`/teachers/${delId}`, { method: 'DELETE' });
      showToast('Teacher deleted', 'success');
      await loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ---------- classes ----------

function renderClasses() {
  const tbody = document.getElementById('classes-table');
  tbody.innerHTML = state.classes.length
    ? state.classes.map((c) => `
        <tr>
          <td>${c.name}</td>
          <td>${c.grade_level || '—'}</td>
          <td>${c.room || '—'}</td>
          <td>${c.teacher_first_name ? `${c.teacher_first_name} ${c.teacher_last_name}` : '—'}</td>
          <td class="row-actions">
            <button data-edit-class="${c.id}">Edit</button>
            <button class="danger" data-delete-class="${c.id}">Delete</button>
          </td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="5">No classes yet — add the first one above.</td></tr>`;
}

const classForm = document.getElementById('form-class');
classForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(classForm);
  const id = fd.get('id');
  const payload = {
    name: fd.get('name'),
    grade_level: fd.get('grade_level') || null,
    room: fd.get('room') || null,
    teacher_id: fd.get('teacher_id') || null,
  };
  try {
    if (id) {
      await api(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Class updated', 'success');
    } else {
      await api('/classes', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Class added', 'success');
    }
    resetForm(classForm);
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('classes-table').addEventListener('click', async (e) => {
  const editId = e.target.dataset.editClass;
  const delId = e.target.dataset.deleteClass;
  if (editId) {
    const c = state.classes.find((x) => String(x.id) === editId);
    fillForm(classForm, c);
  }
  if (delId) {
    if (!confirm('Delete this class? This also removes its enrollments.')) return;
    try {
      await api(`/classes/${delId}`, { method: 'DELETE' });
      showToast('Class deleted', 'success');
      await loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ---------- enrollments ----------

function renderEnrollments() {
  const tbody = document.getElementById('enrollments-table');
  tbody.innerHTML = state.enrollments.length
    ? state.enrollments.map((e) => `
        <tr>
          <td>${e.student_first_name} ${e.student_last_name}</td>
          <td>${e.class_name}</td>
          <td>${fmtDate(e.enrolled_at)}</td>
          <td class="row-actions">
            <button class="danger" data-delete-enrollment="${e.id}">Remove</button>
          </td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="4">No enrollments yet.</td></tr>`;
}

const enrollmentForm = document.getElementById('form-enrollment');
enrollmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(enrollmentForm);
  const payload = {
    student_id: fd.get('student_id'),
    class_id: fd.get('class_id'),
  };
  try {
    await api('/enrollments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Student enrolled', 'success');
    enrollmentForm.reset();
    await loadAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('enrollments-table').addEventListener('click', async (e) => {
  const delId = e.target.dataset.deleteEnrollment;
  if (delId) {
    try {
      await api(`/enrollments/${delId}`, { method: 'DELETE' });
      showToast('Enrollment removed', 'success');
      await loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
});

// ---------- shared form helpers ----------

function fillForm(form, record) {
  form.querySelector('[name="id"]').value = record.id;
  Object.keys(record).forEach((key) => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) field.value = record[key] ?? '';
  });
  const cancelBtn = form.querySelector('[data-cancel-edit]');
  if (cancelBtn) cancelBtn.hidden = false;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Save changes';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm(form) {
  form.reset();
  const idField = form.querySelector('[name="id"]');
  if (idField) idField.value = '';
  const cancelBtn = form.querySelector('[data-cancel-edit]');
  if (cancelBtn) cancelBtn.hidden = true;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = submitBtn.dataset.defaultLabel || submitBtn.textContent;
}

document.querySelectorAll('[data-cancel-edit]').forEach((btn) => {
  btn.addEventListener('click', () => resetForm(btn.closest('form')));
});

// store default labels so resetForm can restore "Add student" etc.
document.querySelectorAll('button[type="submit"]').forEach((btn) => {
  btn.dataset.defaultLabel = btn.textContent;
});

function populateSelects() {
  const teacherSelect = document.querySelector('#form-class select[name="teacher_id"]');
  teacherSelect.innerHTML = '<option value="">— unassigned —</option>' +
    state.teachers.map((t) => `<option value="${t.id}">${fullName(t)}</option>`).join('');

  const studentSelect = document.querySelector('#form-enrollment select[name="student_id"]');
  studentSelect.innerHTML = '<option value="">Select a student…</option>' +
    state.students.map((s) => `<option value="${s.id}">${fullName(s)}</option>`).join('');

  const classSelect = document.querySelector('#form-enrollment select[name="class_id"]');
  classSelect.innerHTML = '<option value="">Select a class…</option>' +
    state.classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ---------- boot ----------

checkApiStatus();
loadAll();
setInterval(checkApiStatus, 15000);
