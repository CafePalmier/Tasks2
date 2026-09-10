const STORAGE_KEY = 'cafe-palmier-task-state';
const TODAY_LIST_KEY = 'cafe-palmier-today-list';
const STATIC_TASKS_PATH = './tasks.json';

const state = {
  tasks: [],
  available: [],
  completed: [],
  page: document.body.dataset.page || 'home'
};

const periodLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

const categoryLabels = {
  cleaning: 'Cleaning',
  stocking: 'Stocking',
  prep: 'Prepping',
  closing: 'Closing',
  general: 'General'
};

const taskPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
const taskCategories = ['cleaning', 'stocking', 'prep', 'closing', 'general'];
const closingAreas = ['Outside', 'Upstairs', 'Downstairs', 'Kitchen', 'Bar', 'General'];

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const byPeriod = (taskPeriods.indexOf(a.period) >= 0 ? taskPeriods.indexOf(a.period) : 99) - (taskPeriods.indexOf(b.period) >= 0 ? taskPeriods.indexOf(b.period) : 99);
    if (byPeriod !== 0) return byPeriod;

    const byCategory = (taskCategories.indexOf(a.category) >= 0 ? taskCategories.indexOf(a.category) : 99) - (taskCategories.indexOf(b.category) >= 0 ? taskCategories.indexOf(b.category) : 99);
    if (byCategory !== 0) return byCategory;

    return (a.order ?? 999) - (b.order ?? 999);
  });
}

function api(path, options = {}) {
  const isTasksApi = path === '/api/tasks';
  const method = (options.method || 'GET').toUpperCase();
  const isLocalServer = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isTasksApi && method === 'GET') {
    const requestPath = isLocalServer ? '/api/tasks' : STATIC_TASKS_PATH;

    return fetch(requestPath, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    }).then((response) => response.json());
  }

  if (isTasksApi && method !== 'GET') {
    if (!isLocalServer) {
      return Promise.reject(new Error('Task editing is not available on GitHub Pages.'));
    }

    return fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    }).then((response) => response.json());
  }

  return fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  }).then((response) => response.json());
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function getPeriodWindow(period, date) {
  switch (period) {
    case 'daily':
      return { start: new Date(date.getFullYear(), date.getMonth(), date.getDate()), end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) };
    case 'weekly':
      return {
        start: startOfWeek(date),
        end: new Date(startOfWeek(date).getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999)
      };
    case 'monthly':
      return { start: startOfMonth(date), end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999) };
    case 'yearly':
      return { start: startOfYear(date), end: new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999) };
    default:
      return { start: new Date(0), end: new Date(0) };
  }
}

function isCompletedInCurrentCycle(task, now) {
  if (!task.lastCompletedAt) return false;

  const completedAt = new Date(task.lastCompletedAt);
  const { start, end } = getPeriodWindow(task.period, now);

  return completedAt >= start && completedAt <= end;
}

function getCurrentDayLabel(now) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function isUrgentTask(task, now) {
  const dayName = getCurrentDayLabel(now);
  return Array.isArray(task.urgentOn) && task.urgentOn.includes(dayName);
}

function buildTaskPayload(tasks, now = new Date()) {
  const available = [];
  const completed = [];

  const sortedTasks = [...tasks].sort((a, b) => {
    const byPeriod = (taskPeriods.indexOf(a.period) >= 0 ? taskPeriods.indexOf(a.period) : 99) - (taskPeriods.indexOf(b.period) >= 0 ? taskPeriods.indexOf(b.period) : 99);
    if (byPeriod !== 0) return byPeriod;

    const byCategory = (taskCategories.indexOf(a.category) >= 0 ? taskCategories.indexOf(a.category) : 99) - (taskCategories.indexOf(b.category) >= 0 ? taskCategories.indexOf(b.category) : 99);
    if (byCategory !== 0) return byCategory;

    return (a.order ?? 999) - (b.order ?? 999);
  });

  for (const task of sortedTasks) {
    if (task.isActive === false) continue;

    const resultTask = {
      ...task,
      urgentToday: isUrgentTask(task, now)
    };

    if (isCompletedInCurrentCycle(task, now)) {
      completed.push(resultTask);
    } else {
      available.push(resultTask);
    }
  }

  return {
    tasks: sortedTasks,
    available,
    completed,
    generatedAt: new Date().toISOString()
  };
}

function getTodayListState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TODAY_LIST_KEY) || '{}');
    const today = new Date().toISOString().slice(0, 10);

    if (saved.date !== today) {
      localStorage.setItem(TODAY_LIST_KEY, JSON.stringify({ date: today, taskIds: [] }));
      return { date: today, taskIds: [] };
    }

    return {
      date: today,
      taskIds: Array.isArray(saved.taskIds) ? saved.taskIds.filter(Boolean) : []
    };
  } catch (error) {
    return { date: new Date().toISOString().slice(0, 10), taskIds: [] };
  }
}

function saveTodayListState(taskIds) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(TODAY_LIST_KEY, JSON.stringify({ date: today, taskIds }));
}

function renderGroups() {
  const root = document.getElementById('taskGroups');
  if (!root) return;

  const homeTasks = sortTasks(state.available.filter((task) => task.category !== 'closing'));
  const todayTaskIds = new Set(getTodayListState().taskIds);

  if (!homeTasks.length) {
    root.innerHTML = `
      <div class="panel-card">
        <h2>Available Tasks</h2>
        <div class="empty-state">No available tasks right now. Everything is complete for this cycle.</div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="panel-card">
      <h2>Available Tasks</h2>
      <div class="task-list">
        ${homeTasks.map((task) => `
          <div class="task-swipe-shell" data-task-id="${task.id}">
            <div class="task-swipe-action">Complete</div>
            <article class="task-item task-swipe-content ${task.urgentToday ? 'urgent' : ''}">
              <input class="task-check" type="checkbox" data-task-id="${task.id}" aria-label="Mark ${escapeHtml(task.title)} complete" />
              <div class="task-main">
                <h4>${escapeHtml(task.title)}</h4>
                ${task.description ? `
                  <details class="task-details">
                    <summary>Details</summary>
                    <p>${escapeHtml(task.description)}</p>
                  </details>
                ` : ''}
                <div class="task-meta">
                  <span class="meta-pill category-pill">${categoryLabels[task.category]}</span>
                  <span class="meta-pill period-pill ${task.period}">${periodLabels[task.period]}</span>
                  ${task.urgentToday ? '<span class="meta-pill urgent">Urgent today</span>' : ''}
                </div>
              </div>
              <div class="task-actions">
                <button class="secondary-btn" data-add-today-id="${task.id}" ${todayTaskIds.has(task.id) ? 'disabled' : ''}>${todayTaskIds.has(task.id) ? 'Added' : 'Add to Today'}</button>
                <button class="icon-btn" data-edit-id="${task.id}">Edit</button>
              </div>
            </article>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('.task-check').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const taskId = event.target.dataset.taskId;
      if (event.target.checked) {
        completeTask(taskId);
      }
    });
  });

  document.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = state.tasks.find((item) => item.id === button.dataset.editId);
      if (task) populateForm(task);
    });
  });

  document.querySelectorAll('[data-add-today-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.addTodayId;
      const currentState = getTodayListState();
      const taskIds = Array.from(new Set([...currentState.taskIds, taskId]));

      saveTodayListState(taskIds);
      renderTodayList();
      renderGroups();
    });
  });

  attachSwipeHandlers();
}

function renderTodayList() {
  const root = document.getElementById('todayList');
  if (!root) return;

  root.id = 'todayList';

  const { taskIds } = getTodayListState();
  const todayTasks = taskIds
    .map((taskId) => state.tasks.find((task) => task.id === taskId))
    .filter(Boolean)
    .filter((task) => task.isActive && task.category !== 'closing');

  root.innerHTML = `
    <h2>Today's List</h2>
    ${todayTasks.length
      ? `
        <ul class="mini-list">
          ${todayTasks.map((task) => `
            <li>
              <span>${escapeHtml(task.title)}</span>
              <button class="icon-btn" data-remove-today-id="${task.id}">Remove</button>
            </li>
          `).join('')}
        </ul>
      `
      : `
        <div class="today-empty">
          <p>No tasks added yet.</p>
          <a class="primary-btn" href="./index.html">Add Tasks</a>
        </div>
      `}
  `;

  root.querySelectorAll('[data-remove-today-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.removeTodayId;
      const currentState = getTodayListState();
      const taskIds = currentState.taskIds.filter((id) => id !== taskId);
      saveTodayListState(taskIds);
      renderTodayList();
      renderGroups();
    });
  });

}

function openCompletedModal() {
  const modal = document.getElementById('completedModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeCompletedModal() {
  const modal = document.getElementById('completedModal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderCompleted() {
  const root = document.getElementById('completedList');
  if (!root) return;

  if (!state.completed.length) {
    root.innerHTML = '<li class="empty-state">No completed items yet</li>';
    return;
  }

  root.innerHTML = state.completed.map((task) => `
    <li>
      <span>${escapeHtml(task.title)}</span>
      <button class="icon-btn" data-reopen-id="${task.id}">Reopen</button>
    </li>
  `).join('');

  root.querySelectorAll('[data-reopen-id]').forEach((button) => {
    button.addEventListener('click', () => reopenTask(button.dataset.reopenId));
  });
}

function renderSummary() {
  const openCount = document.getElementById('openCount');
  const completedCount = document.getElementById('completedCount');
  const urgentCount = document.getElementById('urgentCount');

  if (openCount) openCount.textContent = String(state.available.length || 0);
  if (completedCount) completedCount.textContent = String(state.completed.length || 0);
  if (urgentCount) urgentCount.textContent = String(state.available.filter((task) => task.urgentToday).length || 0);

  const completedButton = document.querySelector('[data-open-completed]');
  if (completedButton) {
    completedButton.onclick = openCompletedModal;
  }
}

function renderClosingList() {
  const root = document.getElementById('closingList');
  if (!root) return;

  const closingAvailable = state.available.filter((task) => task.category === 'closing');
  const closingCompleted = state.completed.filter((task) => task.category === 'closing');

  const groupedAvailable = closingAreas.reduce((acc, area) => {
    acc[area] = closingAvailable.filter((task) => (task.area || 'General') === area);
    return acc;
  }, {});

  const availableMarkup = closingAreas.map((area) => {
    const tasks = groupedAvailable[area];

    if (!tasks.length) {
      return '';
    }

    return `
      <div class="panel-card closing-group">
        <h3>${area}</h3>
        <div class="task-list">
          ${tasks.map((task) => `
            <div class="task-swipe-shell" data-task-id="${task.id}">
              <div class="task-swipe-action">Complete</div>
              <article class="task-item task-swipe-content">
                <input class="task-check" type="checkbox" data-task-id="${task.id}" aria-label="Mark ${escapeHtml(task.title)} complete" />
                <div class="task-main">
                  <h4>${escapeHtml(task.title)}</h4>
                  ${task.description ? `
                    <details class="task-details">
                      <summary>Details</summary>
                      <p>${escapeHtml(task.description)}</p>
                    </details>
                  ` : ''}
                </div>
                <div class="task-actions">
                  <button class="icon-btn" data-edit-id="${task.id}">Edit</button>
                </div>
              </article>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  const completedMarkup = closingCompleted.length
    ? `
      <div class="panel-card small-panel">
        <h2>Completed closing tasks</h2>
        <ul class="mini-list">
          ${closingCompleted.map((task) => `
            <li>
              <span>${escapeHtml(task.title)}</span>
              <button class="icon-btn" data-reopen-id="${task.id}">Reopen</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '';

  root.innerHTML = `
    <div class="closing-stack">
      <div class="panel-card">
        <h2>Open closing list</h2>
        <div class="closing-groups">${availableMarkup || '<div class="empty-state">No closing tasks available right now.</div>'}</div>
      </div>
      ${completedMarkup}
    </div>
  `;

  root.querySelectorAll('.task-check').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const taskId = event.target.dataset.taskId;
      if (event.target.checked) {
        completeTask(taskId);
      }
    });
  });

  root.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = state.tasks.find((item) => item.id === button.dataset.editId);
      if (task) populateForm(task);
    });
  });

  root.querySelectorAll('[data-reopen-id]').forEach((button) => {
    button.addEventListener('click', () => reopenTask(button.dataset.reopenId));
  });

  attachSwipeHandlers();
}

function renderAdminList() {
  const root = document.getElementById('adminTaskList');
  if (!root) return;

  const completedIds = new Set(state.completed.map((task) => task.id));

  root.innerHTML = taskPeriods.map((period) => {
    const periodTasks = sortTasks(state.tasks.filter((task) => task.period === period));
    const groupedByCategory = periodTasks.reduce((acc, task) => {
      const key = task.category || 'general';
      acc[key] ||= [];
      acc[key].push(task);
      return acc;
    }, {});

    const categories = Object.keys(groupedByCategory).sort((a, b) => taskCategories.indexOf(a) - taskCategories.indexOf(b));

    if (!periodTasks.length) {
      return '';
    }

    return `
      <section class="group-card">
        <div class="group-header">
          <h3>${periodLabels[period]}</h3>
          <span class="group-badge">${periodTasks.length}</span>
        </div>
        ${categories.map((category) => `
          <div class="admin-category-block">
            <h4>${categoryLabels[category] || category}</h4>
            <div class="admin-task-list">
              ${groupedByCategory[category].map((task) => `
                <article class="admin-item ${completedIds.has(task.id) ? 'completed' : ''}">
                  <div>
                    <h4>${escapeHtml(task.title)}</h4>
                    <div class="meta">
                      <span>${categoryLabels[task.category] || task.category}</span>
                      <span>${periodLabels[task.period] || task.period}</span>
                      <span class="status-pill ${completedIds.has(task.id) ? 'done' : 'open'}">
                        ${completedIds.has(task.id) ? 'Completed' : 'Open'}
                      </span>
                      ${task.urgentOn?.length ? `<span>Urgent: ${escapeHtml(task.urgentOn.join(', '))}</span>` : ''}
                    </div>
                  </div>
                  <div class="actions">
                    <button class="secondary-btn" data-edit-id="${task.id}">Edit</button>
                    <button class="icon-btn" data-delete-id="${task.id}">Delete</button>
                  </div>
                </article>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </section>
    `;
  }).join('');

  root.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = state.tasks.find((item) => item.id === button.dataset.editId);
      if (task) populateForm(task);
    });
  });

  root.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteTask(button.dataset.deleteId);
    });
  });
}

async function loadTaskData() {
  try {
    const data = await api('/api/tasks');
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const payload = buildTaskPayload(tasks, new Date());

    state.tasks = payload.tasks || tasks;
    state.available = payload.available || [];
    state.completed = payload.completed || [];
    renderAll();
  } catch (error) {
    console.error('Failed to load tasks', error);
    alert('Could not load tasks.');
  }
}

async function completeTask(taskId) {
  const checkbox = document.querySelector(`.task-check[data-task-id="${taskId}"]`);
  if (checkbox) {
    checkbox.checked = true;
  }

  try {
    await api(`/api/tasks/${taskId}/complete`, { method: 'POST' });
    await loadTaskData();
  } catch (error) {
    console.error('Failed to complete task', error);
  }
}

async function reopenTask(taskId) {
  try {
    await api(`/api/tasks/${taskId}/reopen`, { method: 'POST' });
    await loadTaskData();
  } catch (error) {
    console.error('Failed to reopen task', error);
  }
}

async function deleteTask(taskId) {
  try {
    await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
    await loadTaskData();
    resetForm();
  } catch (error) {
    console.error('Failed to delete task', error);
  }
}

function populateForm(task) {
  const form = document.getElementById('taskForm');
  if (!form) return;

  document.getElementById('formTitle').textContent = 'Edit task';
  form.taskId.value = task.id;
  form.title.value = task.title;
  form.category.value = task.category || 'general';
  form.period.value = task.period || 'daily';
  form.urgentOn.value = (task.urgentOn || []).join(', ');
  form.description.value = task.description || '';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.reset();
  document.getElementById('formTitle').textContent = 'Add a task';
  form.taskId.value = '';
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const payload = {
    title: form.title.value.trim(),
    category: form.category.value,
    period: form.period.value,
    description: form.description.value.trim(),
    urgentOn: form.urgentOn.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  };

  if (!payload.title) {
    alert('Please enter a task title.');
    return;
  }

  try {
    if (form.taskId.value) {
      await api(`/api/tasks/${form.taskId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadTaskData();
  } catch (error) {
    console.error('Failed to save task', error);
    alert('Could not save the task.');
  }
}

function renderAll() {
  renderGroups();
  renderTodayList();
  renderCompleted();
  renderSummary();
  renderClosingList();
  renderAdminList();
  attachSwipeHandlers();
}

function attachSwipeHandlers() {
  document.querySelectorAll('.task-swipe-shell').forEach((shell) => {
    const content = shell.querySelector('.task-swipe-content');
    const taskId = shell.dataset.taskId;
    let startX = 0;
    let dragOffset = 0;
    let isDragging = false;

    const resetPosition = () => {
      content.style.transition = 'transform 0.22s ease';
      content.style.transform = 'translateX(0px)';
      shell.classList.remove('revealed');
      dragOffset = 0;
      isDragging = false;
    };

    shell.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input, summary')) {
        return;
      }

      startX = event.clientX;
      isDragging = true;
      content.style.transition = 'none';
      shell.setPointerCapture(event.pointerId);
    });

    shell.addEventListener('pointermove', (event) => {
      if (!isDragging) return;

      const deltaX = Math.max(0, event.clientX - startX);
      dragOffset = Math.min(deltaX, 140);
      content.style.transform = `translateX(${dragOffset}px)`;
      shell.classList.toggle('revealed', dragOffset > 8);
    });

    shell.addEventListener('pointerup', () => {
      if (!isDragging) return;

      if (dragOffset >= 110) {
        const checkbox = shell.querySelector('.task-check');
        if (checkbox) {
          checkbox.checked = true;
        }
        completeTask(taskId);
        return;
      }

      resetPosition();
    });

    shell.addEventListener('pointercancel', resetPosition);
    shell.addEventListener('pointerleave', () => {
      if (!isDragging) return;
      resetPosition();
    });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('taskForm');
  if (form) {
    form.addEventListener('submit', handleTaskSubmit);
    document.getElementById('resetForm').addEventListener('click', resetForm);
  }

  document.querySelectorAll('[data-close-completed]').forEach((button) => {
    button.addEventListener('click', closeCompletedModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCompletedModal();
    }
  });

  await loadTaskData();
});
