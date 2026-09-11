const STORAGE_KEY = 'cafe-palmier-task-state';
const TODAY_LIST_KEY = 'cafe-palmier-today-list';
const DAY_LISTS_KEY = 'cafe-palmier-day-lists-v2';
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
  return getDayListsState().today;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextLocalDateKey(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return localDateKey(next);
}

function emptyDayList(date) {
  return { date, taskIds: [], customItems: [] };
}

function normalizeDayList(value, date) {
  return {
    date,
    taskIds: Array.isArray(value?.taskIds) ? [...new Set(value.taskIds.filter(Boolean))] : [],
    customItems: Array.isArray(value?.customItems)
      ? value.customItems.filter((item) => item?.title).map((item) => ({ id: item.id || `custom-${Date.now()}`, title: String(item.title).trim() }))
      : []
  };
}

function getDayListsState() {
  try {
    const todayDate = localDateKey();
    const tomorrowDate = nextLocalDateKey();
    let saved = JSON.parse(localStorage.getItem(DAY_LISTS_KEY) || 'null');

    if (!saved) {
      const legacy = JSON.parse(localStorage.getItem(TODAY_LIST_KEY) || 'null');
      saved = { today: legacy, tomorrow: null };
    }

    const todaySource = saved?.today?.date === todayDate
      ? saved.today
      : (saved?.tomorrow?.date === todayDate ? saved.tomorrow : null);
    const tomorrowSource = saved?.tomorrow?.date === tomorrowDate ? saved.tomorrow : null;
    const result = {
      today: normalizeDayList(todaySource, todayDate),
      tomorrow: normalizeDayList(tomorrowSource, tomorrowDate)
    };
    localStorage.setItem(DAY_LISTS_KEY, JSON.stringify(result));
    return result;
  } catch (error) {
    return { today: emptyDayList(localDateKey()), tomorrow: emptyDayList(nextLocalDateKey()) };
  }
}

function saveTodayListState(taskIds) {
  const lists = getDayListsState();
  lists.today.taskIds = [...new Set(taskIds)];
  localStorage.setItem(DAY_LISTS_KEY, JSON.stringify(lists));
}

function saveDayListsState(lists) {
  localStorage.setItem(DAY_LISTS_KEY, JSON.stringify(lists));
}

function addTaskToDay(taskId, day) {
  const lists = getDayListsState();
  if (!lists[day].taskIds.includes(taskId)) lists[day].taskIds.push(taskId);
  saveDayListsState(lists);
  renderAll();
}

function removeTaskFromDay(taskId, day) {
  const lists = getDayListsState();
  lists[day].taskIds = lists[day].taskIds.filter((id) => id !== taskId);
  saveDayListsState(lists);
  renderAll();
}

function addCustomDayItem(day, title) {
  const lists = getDayListsState();
  lists[day].customItems.push({ id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title });
  saveDayListsState(lists);
  renderAll();
}

function removeCustomDayItem(day, customId) {
  const lists = getDayListsState();
  lists[day].customItems = lists[day].customItems.filter((item) => item.id !== customId);
  saveDayListsState(lists);
  renderAll();
}

function ensureUrgentTasksInToday() {
  const lists = getDayListsState();
  const urgentIds = state.available
    .filter((task) => task.urgentToday)
    .map((task) => task.id);
  const merged = [...new Set([...lists.today.taskIds, ...urgentIds])];
  if (merged.length !== lists.today.taskIds.length) {
    lists.today.taskIds = merged;
    saveDayListsState(lists);
  }
}

function beginInlineEdit(button) {
  const task = state.tasks.find((item) => item.id === button.dataset.editId);
  if (task) openTaskModal(task);
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
          <div class="task-swipe-shell" data-task-id="${task.id}" data-swipe-mode="tomorrow">
            <button class="task-swipe-action tomorrow" type="button" data-swipe-tomorrow aria-label="Add ${escapeHtml(task.title)} to tomorrow">Tomorrow</button>
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
                <button class="secondary-btn" data-add-today-id="${task.id}">${todayTaskIds.has(task.id) ? 'Remove today' : 'Today'}</button>
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

function renderDayList(day) {
  const root = document.getElementById(day === 'today' ? 'todayList' : 'tomorrowList');
  if (!root) return;
  const lists = getDayListsState();
  const { taskIds, customItems } = lists[day];
  const dayTasks = taskIds
    .map((taskId) => state.tasks.find((task) => task.id === taskId))
    .filter(Boolean)
    .filter((task) => task.isActive);
  const label = day === 'today' ? "Today's List" : "Tomorrow's List";

  root.innerHTML = `
    <div class="list-title-row"><h2>${label}</h2><span class="group-badge">${dayTasks.length + customItems.length}</span></div>
    <form class="quick-day-form" data-quick-day="${day}">
      <input name="title" type="text" placeholder="Write an additional task…" aria-label="Additional task for ${day}" required />
      <button class="primary-btn" type="submit">Add</button>
    </form>
    ${dayTasks.length || customItems.length
      ? `
        <div class="task-list today-task-list">
          ${dayTasks.map((task) => `
            <div class="task-swipe-shell" data-task-id="${task.id}" data-swipe-mode="${day === 'today' ? 'complete' : 'none'}">
              ${day === 'today' ? `<button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>` : ''}
              <article class="task-item task-swipe-content task-item-no-check ${task.urgentToday ? 'urgent' : ''}">
                <div class="task-main"><h4>${escapeHtml(task.title)}</h4></div>
                <div class="task-actions">
                  <button class="icon-btn" data-edit-id="${task.id}">Edit</button>
                  <button class="icon-btn" data-remove-day-id="${task.id}" data-day="${day}">Remove</button>
                </div>
              </article>
            </div>
          `).join('')}
          ${customItems.map((item) => `
            <article class="task-item task-item-no-check one-off-item">
              <div class="task-main"><h4>${escapeHtml(item.title)}</h4><span class="meta-pill category-pill">One-off</span></div>
              <button class="icon-btn" data-remove-custom-id="${item.id}" data-day="${day}">${day === 'today' ? 'Done' : 'Remove'}</button>
            </article>
          `).join('')}
        </div>
      `
      : `<div class="today-empty"><p>No tasks added yet.</p></div>`}
  `;

  root.querySelector('[data-quick-day]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = event.currentTarget.elements.title.value.trim();
    if (title) addCustomDayItem(day, title);
  });
  root.querySelectorAll('[data-remove-day-id]').forEach((button) => {
    button.addEventListener('click', () => removeTaskFromDay(button.dataset.removeDayId, button.dataset.day));
  });
  root.querySelectorAll('[data-remove-custom-id]').forEach((button) => {
    button.addEventListener('click', () => removeCustomDayItem(button.dataset.day, button.dataset.removeCustomId));
  });
  bindInlineEditButtons(root);
  attachSwipeHandlers(root);
}

function renderTodayList() { renderDayList('today'); }
function renderTomorrowList() { renderDayList('tomorrow'); }

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

  const urgentButton = document.querySelector('[data-open-urgent]');
  if (urgentButton) urgentButton.onclick = openUrgentModal;
}

function openUrgentModal() {
  const modal = document.getElementById('urgentModal');
  const list = document.getElementById('urgentList');
  if (!modal || !list) return;
  const urgentTasks = state.available.filter((task) => task.urgentToday);
  list.innerHTML = urgentTasks.length
    ? urgentTasks.map((task) => `<li><span>${escapeHtml(task.title)}</span><span class="meta-pill urgent">Urgent today</span></li>`).join('')
    : '<li class="empty-state">Nothing is urgent today.</li>';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeUrgentModal() {
  const modal = document.getElementById('urgentModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
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
    ensureUrgentTasksInToday();
    renderAll();
  } catch (error) {
    console.error('Failed to load tasks', error);
    alert('Could not load tasks.');
  }
}

async function completeTask(taskId) {
  try {
    await api(`/api/tasks/${taskId}/complete`, { method: 'POST' });
    const lists = getDayListsState();
    lists.today.taskIds = lists.today.taskIds.filter((id) => id !== taskId);
    saveDayListsState(lists);
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
  form.elements.taskId.value = task.id;
  form.elements.title.value = task.title;
  form.elements.category.value = task.category || 'general';
  form.elements.period.value = task.period || 'daily';
  form.elements.urgentOn.value = (task.urgentOn || []).join(', ');
  form.elements.timeTag.value = task.timeTag || '';
  form.elements.description.value = task.description || '';
  const deleteButton = document.getElementById('deleteTaskButton');
  if (deleteButton) deleteButton.hidden = false;
  updatePeriodVisibility();
  openTaskModal();
}

function updatePeriodVisibility() {
  const form = document.getElementById('taskForm');
  const periodField = document.getElementById('periodField');
  if (!form || !periodField) return;

  const isDailyOnly = dailyOnlyCategories.includes(form.elements.category.value);
  periodField.hidden = isDailyOnly;
  form.elements.period.disabled = isDailyOnly;
  if (isDailyOnly) form.elements.period.value = 'daily';
}

function resetForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.reset();
  document.getElementById('formTitle').textContent = 'Add a task';
  form.elements.taskId.value = '';
  const deleteButton = document.getElementById('deleteTaskButton');
  if (deleteButton) deleteButton.hidden = true;
  updatePeriodVisibility();
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const payload = {
    title: form.elements.title.value.trim(),
    category: form.elements.category.value,
    period: dailyOnlyCategories.includes(form.elements.category.value) ? 'daily' : form.elements.period.value,
    description: form.elements.description.value.trim(),
    timeTag: form.elements.timeTag.value.trim(),
    urgentOn: form.elements.urgentOn.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  };

  if (!payload.title) {
    alert('Please enter a task title.');
    return;
  }

  try {
    if (form.elements.taskId.value) {
      await api(`/api/tasks/${form.elements.taskId.value}`, {
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
    closeTaskModal();
  } catch (error) {
    console.error('Failed to save task', error);
    alert('Could not save the task.');
  }
}

function renderAll() {
  renderGroups();
  renderTodayList();
  renderTomorrowList();
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
    const swipeMode = shell.dataset.swipeMode || 'complete';
    if (swipeMode === 'none') return;
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
        if (swipeMode === 'tomorrow') addTaskToDay(taskId, 'tomorrow');
        else if (swipeMode === 'complete') completeTask(taskId);
        else resetPosition();
        return;
      }
      resetPosition();
    });

    shell.addEventListener('pointercancel', resetPosition);
    shell.querySelector('[data-swipe-complete]')?.addEventListener('click', () => completeTask(taskId));
    shell.querySelector('[data-swipe-tomorrow]')?.addEventListener('click', () => addTaskToDay(taskId, 'tomorrow'));
  });
}

function taskFormMarkup() {
  return `
    <div id="taskModal" class="modal hidden" aria-hidden="true">
      <div class="modal-backdrop" data-close-task-modal></div>
      <div class="modal-card task-form-modal" role="dialog" aria-modal="true" aria-labelledby="formTitle">
        <div class="modal-header"><h2 id="formTitle">Add a task</h2><button class="icon-btn" type="button" data-close-task-modal>Close</button></div>
        <form id="taskForm">
          <input type="hidden" id="taskId" name="taskId" />
          <div class="field-grid">
            <label><span>Title</span><input type="text" name="title" required /></label>
            <label><span>Category</span><select name="category"><option value="opening">Opening</option><option value="cleaning" selected>Cleaning</option><option value="stocking">Stocking</option><option value="prep">Prepping</option><option value="closing">Closing</option><option value="general">General</option></select></label>
            <label id="periodField"><span>Period</span><select name="period"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
            <label><span>Time tag</span><input type="text" name="timeTag" placeholder="e.g. 4:30PM+" /></label>
            <label><span>Urgent on</span><input type="text" name="urgentOn" placeholder="Friday, Monday" /></label>
          </div>
          <label><span>Description / elaboration</span><textarea name="description" rows="3" placeholder="Add instructions or notes"></textarea></label>
          <div class="form-actions"><button type="submit" class="primary-btn">Save task</button><button type="button" class="secondary-btn" id="resetForm">Clear form</button><button type="button" class="danger-btn" id="deleteTaskButton" hidden>Delete task</button></div>
        </form>
      </div>
    </div>`;
}

function ensureAppChrome() {
  const topbar = document.querySelector('.topbar');
  if (topbar && !topbar.querySelector('[data-open-task-modal]')) {
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-item-field';
    addButton.dataset.openTaskModal = '';
    addButton.innerHTML = '<span>＋</span> Add item';
    topbar.insertBefore(addButton, topbar.querySelector('.nav'));
  }
  if (!document.getElementById('taskForm')) document.body.insertAdjacentHTML('beforeend', taskFormMarkup());
  if (!document.getElementById('urgentModal')) {
    document.body.insertAdjacentHTML('beforeend', '<div id="urgentModal" class="modal hidden" aria-hidden="true"><div class="modal-backdrop" data-close-urgent></div><div class="modal-card"><div class="modal-header"><h2>Urgent Today</h2><button class="icon-btn" type="button" data-close-urgent>Close</button></div><ul id="urgentList" class="mini-list modal-list"></ul></div></div>');
  }
}

function scheduleMidnightRollover() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  setTimeout(async () => {
    getDayListsState();
    await loadTaskData();
    scheduleMidnightRollover();
  }, nextMidnight.getTime() - now.getTime());
}

function openTaskModal(task) {
  const modal = document.getElementById('taskModal');
  if (!modal) {
    document.getElementById('taskForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (task) {
    const form = document.getElementById('taskForm');
    document.getElementById('formTitle').textContent = 'Edit task';
    form.elements.taskId.value = task.id;
    form.elements.title.value = task.title;
    form.elements.category.value = task.category || 'general';
    form.elements.period.value = task.period || 'daily';
    form.elements.urgentOn.value = (task.urgentOn || []).join(', ');
    form.elements.timeTag.value = task.timeTag || '';
    form.elements.description.value = task.description || '';
    document.getElementById('deleteTaskButton').hidden = false;
    updatePeriodVisibility();
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('taskForm')?.elements.title.focus(), 0);
}

function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

window.addEventListener('DOMContentLoaded', async () => {
  ensureAppChrome();
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
  document.querySelectorAll('[data-open-task-modal]').forEach((button) => button.addEventListener('click', () => { resetForm(); openTaskModal(); }));
  document.querySelectorAll('[data-close-task-modal]').forEach((button) => button.addEventListener('click', closeTaskModal));
  document.querySelectorAll('[data-close-urgent]').forEach((button) => button.addEventListener('click', closeUrgentModal));
  document.getElementById('deleteTaskButton')?.addEventListener('click', async () => {
    const taskId = document.getElementById('taskForm').elements.taskId.value;
    if (taskId && window.confirm('Delete this task?')) {
      await deleteTask(taskId);
      closeTaskModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCompletedModal();
      closeUrgentModal();
      closeTaskModal();
    }
  });

  await loadTaskData();
  scheduleMidnightRollover();

  const editTaskId = new URLSearchParams(window.location.search).get('edit');
  if (editTaskId && form) {
    const task = state.tasks.find((item) => item.id === editTaskId);
    if (task) populateForm(task);
  }
});
