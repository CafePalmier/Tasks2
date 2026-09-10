const STORAGE_KEY = 'cafe-palmier-task-state';
const TODAY_LIST_KEY = 'cafe-palmier-today-list';
const STATIC_TASKS_PATH = './tasks.json';
const TASK_DATA_VERSION = 4;

const state = {
  tasks: [],
  available: [],
  completed: [],
  hasTaskApi: null,
  page: document.body.dataset.page || 'home'
};

const periodLabels = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

const categoryLabels = {
  opening: 'Opening',
  cleaning: 'Cleaning',
  stocking: 'Stocking',
  prep: 'Prepping',
  closing: 'Closing',
  general: 'General'
};

const taskPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
const taskCategories = ['opening', 'cleaning', 'stocking', 'prep', 'closing', 'general'];
const dailyOnlyCategories = ['opening', 'closing'];
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

function getLocalTasks(fallbackTasks = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const savedTasks = Array.isArray(saved) ? saved : saved?.tasks;
    if (!Array.isArray(savedTasks)) return fallbackTasks;
    if (saved?.version === TASK_DATA_VERSION) return savedTasks;

    const savedById = new Map(savedTasks.map((task) => [task.id, task]));
    const refreshedTasks = fallbackTasks.map((task) => ({
      ...task,
      lastCompletedAt: savedById.get(task.id)?.lastCompletedAt || task.lastCompletedAt
    }));
    const newLocalTasks = savedTasks.filter((task) => !fallbackTasks.some((item) => item.id === task.id));
    const mergedTasks = [...refreshedTasks, ...newLocalTasks];
    saveLocalTasks(mergedTasks);
    return mergedTasks;
  } catch (error) {
    return fallbackTasks;
  }
}

function saveLocalTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: TASK_DATA_VERSION, tasks }));
}

function localTaskApi(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const segments = path.split('/').filter(Boolean);
  const taskId = segments[2];
  const action = segments[3];
  const body = options.body ? JSON.parse(options.body) : {};
  let tasks = [...state.tasks];

  if (path === '/api/tasks' && method === 'POST') {
    const task = {
      ...body,
      id: `task-${Date.now()}`,
      period: dailyOnlyCategories.includes(body.category) ? 'daily' : (body.period || 'daily'),
      description: body.description || '',
      urgentOn: Array.isArray(body.urgentOn) ? body.urgentOn : [],
      isActive: true,
      lastCompletedAt: null,
      area: body.area || 'General',
      order: Math.max(0, ...tasks.map((item) => Number(item.order) || 0)) + 1
    };
    tasks.push(task);
    saveLocalTasks(tasks);
    return Promise.resolve({ task });
  }

  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return Promise.reject(new Error('Task not found'));

  if (method === 'PUT') {
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...body,
      period: dailyOnlyCategories.includes(body.category) ? 'daily' : (body.period || tasks[taskIndex].period)
    };
  } else if (method === 'DELETE') {
    tasks = tasks.filter((task) => task.id !== taskId);
  } else if (method === 'POST' && action === 'complete') {
    tasks[taskIndex].lastCompletedAt = new Date().toISOString();
  } else if (method === 'POST' && action === 'reopen') {
    tasks[taskIndex].lastCompletedAt = null;
  } else {
    return Promise.reject(new Error('Unsupported task action'));
  }

  saveLocalTasks(tasks);
  return Promise.resolve({ task: tasks[taskIndex], deleted: method === 'DELETE' });
}

function api(path, options = {}) {
  const isTasksApi = path.startsWith('/api/tasks');
  const method = (options.method || 'GET').toUpperCase();
  const isLocalServer = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (path === '/api/tasks' && method === 'GET') {
    const getJson = (requestPath) => fetch(requestPath, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Task request failed with ${response.status}`);
      }
      return response.json();
    });

    if (isLocalServer) {
      return getJson('/api/tasks')
        .then((data) => {
          state.hasTaskApi = true;
          return data;
        })
        .catch(() => {
          state.hasTaskApi = false;
          return getJson(STATIC_TASKS_PATH).then((data) => ({
            ...data,
            tasks: getLocalTasks(data.tasks || [])
          }));
        });
    }

    state.hasTaskApi = false;
    return getJson(STATIC_TASKS_PATH).then((data) => ({
      ...data,
      tasks: getLocalTasks(data.tasks || [])
    }));
  }

  if (isTasksApi && method !== 'GET' && state.hasTaskApi === false) {
    return localTaskApi(path, options);
  }

  if (isTasksApi && method !== 'GET' && isLocalServer) {
    return fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    }).then((response) => {
      if (!response.ok) throw new Error(`Task request failed with ${response.status}`);
      return response.json();
    });
  }

  if (isTasksApi && method !== 'GET') {
    return localTaskApi(path, options);
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

function beginInlineEdit(button) {
  const task = state.tasks.find((item) => item.id === button.dataset.editId);
  const card = button.closest('.task-item');
  if (!task || !card || card.classList.contains('is-editing')) return;

  const main = card.querySelector('.task-main');
  const actions = card.querySelector('.task-actions');
  if (!main || !actions) return;

  card.classList.add('is-editing');
  main.innerHTML = `<input class="inline-task-input" type="text" value="${escapeHtml(task.title)}" aria-label="Task title" />`;
  actions.innerHTML = `
    <button class="primary-btn" type="button" data-inline-save>Save</button>
    <button class="icon-btn" type="button" data-inline-cancel>Cancel</button>
  `;

  const input = main.querySelector('.inline-task-input');
  const saveButton = actions.querySelector('[data-inline-save]');
  const cancelButton = actions.querySelector('[data-inline-cancel]');

  const cancel = () => renderAll();
  const save = async () => {
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }

    saveButton.disabled = true;
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title })
      });
      await loadTaskData();
    } catch (error) {
      console.error('Failed to update task title', error);
      saveButton.disabled = false;
    }
  };

  saveButton.addEventListener('click', save);
  cancelButton.addEventListener('click', cancel);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') save();
    if (event.key === 'Escape') cancel();
  });
  input.focus();
  input.select();
}

function bindInlineEditButtons(scope = document) {
  scope.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => beginInlineEdit(button));
  });
}

function renderGroups() {
  const root = document.getElementById('taskGroups');
  if (!root) return;

  const homeTasks = sortTasks(state.available.filter((task) => !['opening', 'closing'].includes(task.category)));
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
            <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
            <article class="task-item task-swipe-content task-item-no-check ${task.urgentToday ? 'urgent' : ''}">
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
                <button class="secondary-btn" data-add-today-id="${task.id}">${todayTaskIds.has(task.id) ? 'Remove' : 'Add to Today'}</button>
                <button class="icon-btn" data-edit-id="${task.id}">Edit</button>
              </div>
            </article>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  bindInlineEditButtons();

  document.querySelectorAll('[data-add-today-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.addTodayId;
      const currentState = getTodayListState();
      const taskIds = currentState.taskIds.includes(taskId)
        ? currentState.taskIds.filter((id) => id !== taskId)
        : [...currentState.taskIds, taskId];

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
    .filter((task) => task.isActive && !['opening', 'closing'].includes(task.category));

  root.innerHTML = `
    <h2>Today's List</h2>
    ${todayTasks.length
      ? `
        <div class="task-list today-task-list">
          ${todayTasks.map((task) => `
            <div class="task-swipe-shell" data-task-id="${task.id}">
              <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
              <article class="task-item task-swipe-content task-item-no-check">
                <div class="task-main"><h4>${escapeHtml(task.title)}</h4></div>
                <div class="task-actions"><button class="icon-btn" data-remove-today-id="${task.id}">Remove</button></div>
              </article>
            </div>
          `).join('')}
        </div>
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
  attachSwipeHandlers(root);
}

function renderOpeningList() {
  const root = document.getElementById('openingList');
  if (!root) return;

  const openingAvailable = sortTasks(state.available.filter((task) => task.category === 'opening'));
  const openingCompleted = state.completed.filter((task) => task.category === 'opening');

  root.innerHTML = `
    <div class="list-title-row">
      <div><p class="eyebrow">Start of day</p><h2>Opening List</h2></div>
      <span class="group-badge">${openingAvailable.length} left</span>
    </div>
    ${openingAvailable.length ? `<div class="task-list">
      ${openingAvailable.map((task) => `
        <div class="task-swipe-shell" data-task-id="${task.id}">
          <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
          <article class="task-item task-swipe-content task-item-no-check">
            <div class="task-main"><h4>${escapeHtml(task.title)}</h4></div>
            <div class="task-actions"><button class="icon-btn" data-edit-id="${task.id}">Edit</button></div>
          </article>
        </div>
      `).join('')}
    </div>` : '<div class="empty-state">Opening is complete for today.</div>'}
    ${openingCompleted.length ? `<div class="completed-section"><h3>Completed today</h3><ul class="mini-list">${openingCompleted.map((task) => `<li><span>${escapeHtml(task.title)}</span><button class="icon-btn" data-reopen-id="${task.id}">Reopen</button></li>`).join('')}</ul></div>` : ''}
  `;

  bindInlineEditButtons(root);
  root.querySelectorAll('[data-reopen-id]').forEach((button) => {
    button.addEventListener('click', () => reopenTask(button.dataset.reopenId));
  });
  attachSwipeHandlers(root);
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

function getClosingSortMode() {
  try {
    return localStorage.getItem('cafe-palmier-closing-sort') === 'time' ? 'time' : 'area';
  } catch (error) {
    return 'area';
  }
}

function getTimeTagOrder(timeTag) {
  const match = String(timeTag || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

function renderClosingTask(task, showAreaTag) {
  return `
    <div class="task-swipe-shell" data-task-id="${task.id}">
      <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
      <article class="task-item task-swipe-content task-item-no-check">
        <div class="task-main">
          <h4>${escapeHtml(task.title)}</h4>
          ${showAreaTag
            ? `<span class="meta-pill area-pill">${escapeHtml(task.area || 'General')}</span>`
            : (task.timeTag ? `<span class="time-pill">${escapeHtml(task.timeTag)}</span>` : '')}
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
  `;
}

function renderClosingList() {
  const root = document.getElementById('closingList');
  if (!root) return;

  const closingAvailable = state.available.filter((task) => task.category === 'closing');
  const closingCompleted = state.completed.filter((task) => task.category === 'closing');
  const sortMode = getClosingSortMode();

  let availableMarkup = '';
  if (sortMode === 'time') {
    const timeGroups = closingAvailable.reduce((groups, task) => {
      const key = task.timeTag || 'Any time';
      groups[key] ||= {};
      const area = task.area || 'General';
      groups[key][area] ||= [];
      groups[key][area].push(task);
      return groups;
    }, {});

    availableMarkup = Object.entries(timeGroups)
      .sort(([first], [second]) => getTimeTagOrder(first) - getTimeTagOrder(second) || first.localeCompare(second))
      .map(([timeTag, areaGroups]) => {
        const areaBlocks = closingAreas.map((area) => {
          const tasks = areaGroups[area] || [];
          if (!tasks.length) return '';

          return `
            <div class="closing-area-block">
              <h4>${escapeHtml(area)}</h4>
              <div class="task-list">${sortTasks(tasks).map((task) => renderClosingTask(task, false)).join('')}</div>
            </div>
          `;
        }).join('');

        return `
          <div class="panel-card closing-group closing-time-group">
            <h3>${escapeHtml(timeTag)}</h3>
            <div class="closing-time-area-groups">${areaBlocks || '<div class="empty-state">No closing tasks in this time group.</div>'}</div>
          </div>
        `;
      }).join('');
  } else {
    const groupedAvailable = closingAreas.reduce((groups, area) => {
      groups[area] = closingAvailable.filter((task) => (task.area || 'General') === area);
      return groups;
    }, {});

    availableMarkup = closingAreas.map((area) => {
      const tasks = groupedAvailable[area];
      if (!tasks.length) return '';
      return `
        <div class="panel-card closing-group">
          <h3>${area}</h3>
          <div class="task-list">${sortTasks(tasks).map((task) => renderClosingTask(task, false)).join('')}</div>
        </div>
      `;
    }).join('');
  }

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
        <div class="list-title-row">
          <h2>Closing list</h2>
          <button class="secondary-btn" type="button" data-closing-sort aria-pressed="${sortMode === 'time'}">${sortMode === 'time' ? 'Sort by section' : 'Sort by time'}</button>
        </div>
        <div class="closing-groups ${sortMode === 'time' ? 'closing-groups-by-time' : ''}">${availableMarkup || '<div class="empty-state">No closing tasks available right now.</div>'}</div>
      </div>
      ${completedMarkup}
    </div>
  `;

  bindInlineEditButtons(root);

  root.querySelectorAll('[data-reopen-id]').forEach((button) => {
    button.addEventListener('click', () => reopenTask(button.dataset.reopenId));
  });

  root.querySelector('[data-closing-sort]')?.addEventListener('click', () => {
    try {
      localStorage.setItem('cafe-palmier-closing-sort', sortMode === 'time' ? 'area' : 'time');
    } catch (error) {
      // The current view remains usable if local storage is unavailable.
    }
    renderClosingList();
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
                      ${task.timeTag ? `<span class="time-pill">${escapeHtml(task.timeTag)}</span>` : ''}
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
  form.timeTag.value = task.timeTag || '';
  form.description.value = task.description || '';
  updatePeriodVisibility();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updatePeriodVisibility() {
  const form = document.getElementById('taskForm');
  const periodField = document.getElementById('periodField');
  if (!form || !periodField) return;

  const isDailyOnly = dailyOnlyCategories.includes(form.category.value);
  periodField.hidden = isDailyOnly;
  form.period.disabled = isDailyOnly;
  if (isDailyOnly) form.period.value = 'daily';
}

function resetForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.reset();
  document.getElementById('formTitle').textContent = 'Add a task';
  form.taskId.value = '';
  updatePeriodVisibility();
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const payload = {
    title: form.title.value.trim(),
    category: form.category.value,
    period: dailyOnlyCategories.includes(form.category.value) ? 'daily' : form.period.value,
    description: form.description.value.trim(),
    timeTag: form.timeTag.value.trim(),
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
  renderOpeningList();
  renderCompleted();
  renderSummary();
  renderClosingList();
  renderAdminList();
  attachSwipeHandlers();
}

function attachSwipeHandlers(scope = document) {
  scope.querySelectorAll('.task-swipe-shell').forEach((shell) => {
    if (shell.dataset.swipeReady === 'true') return;
    shell.dataset.swipeReady = 'true';
    const content = shell.querySelector('.task-swipe-content');
    const taskId = shell.dataset.taskId;
    let startX = 0;
    let startY = 0;
    let dragOffset = 0;
    let isDragging = false;
    let directionLocked = false;
    let isHorizontal = false;

    const resetPosition = () => {
      content.style.transition = 'transform 0.22s ease';
      content.style.transform = 'translateX(0px)';
      shell.classList.remove('revealed');
      shell.classList.remove('ready-to-complete');
      dragOffset = 0;
      isDragging = false;
      directionLocked = false;
      isHorizontal = false;
    };

    shell.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input, summary')) {
        return;
      }

      startX = event.clientX;
      startY = event.clientY;
      isDragging = true;
      directionLocked = false;
      content.style.transition = 'none';
      shell.setPointerCapture(event.pointerId);
    });

    shell.addEventListener('pointermove', (event) => {
      if (!isDragging) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!directionLocked && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
        directionLocked = true;
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      }
      if (!isHorizontal) return;
      event.preventDefault();
      dragOffset = Math.max(-128, Math.min(0, deltaX));
      content.style.transform = `translateX(${dragOffset}px)`;
      shell.classList.toggle('revealed', dragOffset < -8);
      shell.classList.toggle('ready-to-complete', dragOffset <= -92);
    });

    shell.addEventListener('pointerup', () => {
      if (!isDragging) return;

      if (dragOffset <= -92) {
        completeTask(taskId);
        return;
      }
      resetPosition();
    });

    shell.addEventListener('pointercancel', resetPosition);
    shell.querySelector('[data-swipe-complete]')?.addEventListener('click', () => completeTask(taskId));
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('taskForm');
  if (form) {
    form.addEventListener('submit', handleTaskSubmit);
    document.getElementById('resetForm').addEventListener('click', resetForm);
    const categorySelect = form.elements.category;
    categorySelect.addEventListener('change', updatePeriodVisibility);
    updatePeriodVisibility();
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

  const editTaskId = new URLSearchParams(window.location.search).get('edit');
  if (editTaskId && form) {
    const task = state.tasks.find((item) => item.id === editTaskId);
    if (task) populateForm(task);
  }
});
