const STORAGE_KEY = 'cafe-palmier-task-state';
const TODAY_LIST_KEY = 'cafe-palmier-today-list';
const DAY_LISTS_KEY = 'cafe-palmier-day-lists-v2';
const SEASON_KEY = 'cafe-palmier-season';
const SEASON_OVERRIDE_DATE_KEY = 'cafe-palmier-season-override-date';
const STATIC_TASKS_PATH = './tasks.json';
const TASK_DATA_VERSION = 5;
const CELEBRATION_PROGRESS_KEY = 'cafe-palmier-five-task-celebration';

const state = {
  tasks: [],
  available: [],
  completed: [],
  completedFilter: null,
  availableSearch: '',
  completedSearch: '',
  hasTaskApi: null,
  dayLists: null,
  season: getSavedSeason(),
  page: document.body.dataset.page || 'home'
};

let dayListRevision = 0;
let dayListSyncQueue = Promise.resolve();
let urgentDropdownDismissalBound = false;

const supabaseConfig = window.SUPABASE_CONFIG;
const usesSupabase = Boolean(supabaseConfig?.url && supabaseConfig?.publishableKey)
  && !['localhost', '127.0.0.1'].includes(window.location.hostname);

const periodLabels = {
  shift: 'Shift',
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

const categoryTagIcons = {
  stocking: '📦',
  cleaning: '🫧'
};

const taskPeriods = ['shift', 'weekly', 'monthly', 'yearly'];
const taskCategories = ['opening', 'cleaning', 'stocking', 'prep', 'closing', 'general'];
const shiftOnlyCategories = ['opening', 'closing'];
const closingAreas = ['Outside', 'Upstairs', 'Downstairs', 'Kitchen', 'Bar', 'General'];
const openingStages = ['first', 'second', 'third'];
const openingStageLabels = { first: 'First', second: 'Second', third: 'Third' };
const seasonLabels = { winter: 'Winter', summer: 'Summer', both: 'Winter & Summer' };
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const encouragementMessages = [
  'You’re so back 😤',
  'Huge behavior 🫡',
  'Absolute scenes 🎬',
  'We love to see it 🤝',
  'Casual W 😌🏆',
  'Extremely slay of you 💅',
  'Kinda iconic ngl ✨',
  'Certified banger 🔥',
  'Go off then 👏',
  'You ate that 🍽️',
  'Big day for you honestly 📈',
  'Character development 📚✨',
  'Lore just expanded 🧙',
  'Plot armor activated 🛡️',
  'Main quest completed ⚔️',
  'Side quest absolutely demolished 🗺️',
  'The grind has yielded fruit 🍎',
  'Okayyyy productivity 👀',
  'Look at you being functional 😭👏',
  'Disgustingly competent 🤢🔥',
  'Unreasonable levels of success 📊',
  'That was suspiciously well done 🤨',
  'You cooked 👨‍🍳🔥',
  'Let them cook 🍳',
  'Michelin star behavior ⭐',
  'No crumbs detected 🕵️',
  'Absolutely devoured 🫶',
  'Clean work chief 🫡',
  'Another one for the history books 📖',
  'Monumental stuff really 🗿',
  'The council approves 🧙‍♂️✅',
  'The vibes are immaculate 🌈',
  'Nature is healing 🌱',
  'Balance has been restored ⚖️',
  'Civilization advances 🏛️',
  'Humanity wins again 🌎',
  'Scientists are baffled 🔬',
  'Historians will remember this 📜',
  'Generational performance 👑',
  'Hall of fame stuff 🏆',
  'Bro is thriving 📈',
  'Bro really did the thing 😭',
  'Dawg actually pulled it off 🐕',
  'Insane work gang 🤝',
  'Elite form 🥇',
  'Built different 🧱',
  'Unironically impressive 🫡',
  'Okay superstar 🌟',
  'Oh you’re LOCKED IN 🔒',
  'We are so unbelievably back 🚀',
  'Momentum acquired 🏃💨',
  'The streak lives 🔥',
  'Another brick in the empire 🧱👑',
  'Tiny victory, massive aura ✨',
  '+100 aura 🌀',
  'Aura farming successful 🌾',
  'XP gained 🎮',
  'Level up ⬆️',
  'Achievement unlocked 🏅',
  'Quest complete ✅',
  'Boss defeated 💀⚔️',
  'Critical hit 💥',
  'Combo continues 🔥',
  'Perfect run 🎮',
  'That’s cinema 🎥',
  'Peak fiction ✍️',
  'Cinema has returned 🍿',
  'Oh we’re cooking now 🍳🔥',
  'Dangerous levels of momentum ⚠️',
  'Absolutely irresponsible amount of progress 🚨',
  'Frankly this is getting out of hand 📈',
  'Save some competence for the rest of us 😭',
  'Who gave you permission to pop off like this 💀',
  'Unfortunately… you crushed it 😔🏆',
  'Hate to see someone succeed this hard 😭',
  'Embarrassing how good that was 🫣',
  'Honestly rude to make it look that easy 😤',
  'Okay show-off 🙄✨',
  'Another devastating victory 😔',
  'Terrible news: you’re killing it 📢',
  'Sources confirm: massive W 📰',
  'Experts are calling this “pretty sick” 🧑‍🔬',
  'Officially not messing around anymore 🚨',
  'This goes unbelievably hard 🗣️🔥',
  'That’s what I’m TALKING about 🗣️',
  'Hell yeah brother 🦅',
  'Let’s GOOOOOO 🚀',
  'YESSIRRR 🫡',
  'Oh hell yeah 😎',
  'Beautiful stuff 🤌',
  'Gorgeous work 🤌✨',
  'Love this for you 🫶',
  'Proud of you fr 🥹',
  'You did your little thing 🥹✨',
  'Keep being weirdly powerful 🧙',
  'Keep causing problems for mediocrity 😈',
  'Continue your reign 👑',
  'Carry on, legend 🫡',
  'Forward, soldier 🫡',
  'Onto the next boss ⚔️',
  'Maintain course captain 🛳️',
  'Keep the sauce flowing 🫗',
  'The machine is operational ⚙️',
  'Engine’s warm now 🏎️',
  'We got motion 🏃',
  'Momentum baby 📈🔥',
  'One step closer to becoming unbearable 😌'
];

function normalizeSeason(value) {
  return ['winter', 'summer', 'both'].includes(value) ? value : 'both';
}

function getAutomaticSeason(date = new Date()) {
  const month = date.getMonth();
  const isWinterOrFirstHalfOfSpring = month === 11
    || month <= 2
    || (month === 3 && date.getDate() <= 15);
  return isWinterOrFirstHalfOfSpring ? 'winter' : 'summer';
}

function getSavedSeason(date = new Date()) {
  const automaticSeason = getAutomaticSeason(date);
  try {
    const savedSeason = localStorage.getItem(SEASON_KEY);
    const overrideDate = localStorage.getItem(SEASON_OVERRIDE_DATE_KEY);
    if (overrideDate === localDateKey(date) && ['winter', 'summer'].includes(savedSeason)) {
      return savedSeason;
    }
    localStorage.removeItem(SEASON_OVERRIDE_DATE_KEY);
    localStorage.setItem(SEASON_KEY, automaticSeason);
    return automaticSeason;
  } catch (error) {
    return automaticSeason;
  }
}

function saveSeasonSelection(season, date = new Date()) {
  try {
    if (season === getAutomaticSeason(date)) {
      localStorage.removeItem(SEASON_OVERRIDE_DATE_KEY);
    } else {
      localStorage.setItem(SEASON_OVERRIDE_DATE_KEY, localDateKey(date));
    }
    localStorage.setItem(SEASON_KEY, season);
  } catch (error) {
    // Keep the selection in memory when local storage is unavailable.
  }
}

function taskMatchesSeason(task) {
  const season = normalizeSeason(task.season);
  return season === 'both' || season === state.season;
}

function normalizeChecklist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string'
      ? { text: item.trim(), checked: false }
      : { text: String(item?.text || '').trim(), checked: item?.checked === true })
    .filter((item) => item.text);
}

function checklistFromText(value, existingChecklist = []) {
  const existing = normalizeChecklist(existingChecklist);
  const usedIndexes = new Set();
  return String(value || '')
    .split('\n')
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => {
      const existingIndex = existing.findIndex((item, index) => !usedIndexes.has(index) && item.text === text);
      if (existingIndex >= 0) usedIndexes.add(existingIndex);
      return { text, checked: existingIndex >= 0 && existing[existingIndex].checked };
    });
}

function checklistEditorMarkup() {
  return `
    <div class="checklist-editor" data-checklist-editor>
      <span>Checklist</span>
      <div class="checklist-editor-layout">
        <div><div class="checklist-editor-items" data-checklist-editor-items></div><button type="button" class="secondary-btn checklist-add-item" data-add-checklist-item>+ Add checklist item</button></div>
        <div class="checklist-image-editor">
          <input type="hidden" name="checklistImage" />
          <label class="checklist-image-upload">Add reference image<input type="file" accept="image/*" data-checklist-image-input /></label>
          <div class="checklist-image-preview" data-checklist-image-preview hidden><img alt="Checklist reference preview" data-checklist-image-preview-image /><button type="button" class="icon-btn" data-remove-checklist-image>Remove</button></div>
        </div>
      </div>
    </div>`;
}

function readStoredChecklist(values) {
  const value = values.find((item) => typeof item === 'string' && item.startsWith('__checklist:'));
  if (!value) return null;
  try {
    return normalizeChecklist(JSON.parse(decodeURIComponent(value.slice('__checklist:'.length))));
  } catch (error) {
    return [];
  }
}

function readStoredChecklistImage(values) {
  const value = values.find((item) => typeof item === 'string' && item.startsWith('__checklistImage:'));
  return value ? value.slice('__checklistImage:'.length) : '';
}

function categoryTagLabel(category) {
  const icon = categoryTagIcons[category];
  return `${icon ? `${icon} ` : ''}${categoryLabels[category] || category}`;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const byPeriod = (taskPeriods.indexOf(a.period) >= 0 ? taskPeriods.indexOf(a.period) : 99) - (taskPeriods.indexOf(b.period) >= 0 ? taskPeriods.indexOf(b.period) : 99);
    if (byPeriod !== 0) return byPeriod;

    const byCategory = (taskCategories.indexOf(a.category) >= 0 ? taskCategories.indexOf(a.category) : 99) - (taskCategories.indexOf(b.category) >= 0 ? taskCategories.indexOf(b.category) : 99);
    if (byCategory !== 0) return byCategory;

    return (a.order ?? 999) - (b.order ?? 999);
  });
}

function getAvailableTasksForDayList(taskIds, query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return sortTasks(state.available)
    .filter((task) => !shiftOnlyCategories.includes(task.category))
    .filter((task) => !taskIds.includes(task.id))
    .filter((task) => !normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery));
}

function getLocalTasks(fallbackTasks = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const savedTasks = Array.isArray(saved) ? saved : saved?.tasks;
    if (!Array.isArray(savedTasks)) return fallbackTasks;
    if (saved?.version === TASK_DATA_VERSION) return savedTasks.filter((task) => task.period !== 'daily');

    const savedById = new Map(savedTasks.map((task) => [task.id, task]));
    const refreshedTasks = fallbackTasks.map((task) => ({
      ...task,
      lastCompletedAt: savedById.get(task.id)?.lastCompletedAt || task.lastCompletedAt
    }));
    const newLocalTasks = savedTasks.filter((task) => task.period !== 'daily' && !fallbackTasks.some((item) => item.id === task.id));
    const mergedTasks = [...refreshedTasks, ...newLocalTasks];
    saveLocalTasks(mergedTasks);
    return mergedTasks;
  } catch (error) {
    return fallbackTasks;
  }
}

function saveLocalTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: TASK_DATA_VERSION, tasks }));
  } catch (error) {
    console.warn('Could not update the device copy of the tasks', error);
  }
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
      period: shiftOnlyCategories.includes(body.category) ? 'shift' : (body.period || 'weekly'),
      description: body.description || '',
      checklist: normalizeChecklist(body.checklist),
      season: normalizeSeason(body.season),
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
      period: shiftOnlyCategories.includes(body.category) ? 'shift' : (body.period || tasks[taskIndex].period)
    };
  } else if (method === 'DELETE') {
    tasks = tasks.filter((task) => task.id !== taskId);
  } else if (method === 'POST' && action === 'complete') {
    tasks[taskIndex].lastCompletedAt = new Date().toISOString();
  } else if (method === 'POST' && action === 'reopen') {
    tasks[taskIndex].lastCompletedAt = null;
    tasks[taskIndex].checklist = uncheckedChecklist(tasks[taskIndex].checklist);
  } else {
    return Promise.reject(new Error('Unsupported task action'));
  }

  saveLocalTasks(tasks);
  return Promise.resolve({ task: tasks[taskIndex], deleted: method === 'DELETE' });
}

function fromDatabaseTask(task) {
  const urgentValues = Array.isArray(task.urgent_on) ? task.urgent_on : [];
  const storedSeason = urgentValues
    .find((value) => typeof value === 'string' && value.startsWith('__season:'))
    ?.slice('__season:'.length);
  return {
    ...task,
    timeTag: task.time_tag || '',
    urgentOn: urgentValues.filter((value) => typeof value !== 'string' || (!value.startsWith('__season:') && !value.startsWith('__checklist:') && !value.startsWith('__checklistImage:'))),
    isActive: task.is_active !== false,
    lastCompletedAt: task.last_completed_at || null,
    order: task.task_order ?? 0,
    checklist: readStoredChecklist(urgentValues) ?? normalizeChecklist(task.checklist),
    checklistImage: readStoredChecklistImage(urgentValues),
    season: normalizeSeason(storedSeason || task.season)
  };
}

function toDatabaseTask(task) {
  return {
    id: task.id,
    title: task.title,
    category: task.category || 'general',
    period: task.period || 'weekly',
    description: task.description || '',
    time_tag: task.timeTag || '',
    urgent_on: [
      ...(Array.isArray(task.urgentOn) ? task.urgentOn.filter((value) => typeof value !== 'string' || (!value.startsWith('__season:') && !value.startsWith('__checklist:') && !value.startsWith('__checklistImage:'))) : []),
      `__season:${normalizeSeason(task.season)}`,
      `__checklist:${encodeURIComponent(JSON.stringify(normalizeChecklist(task.checklist)))}`,
      `__checklistImage:${typeof task.checklistImage === 'string' ? task.checklistImage : ''}`
    ],
    is_active: task.isActive !== false,
    last_completed_at: task.lastCompletedAt || null,
    area: task.area || 'General',
    task_order: Number(task.order) || 0,
    updated_at: new Date().toISOString()
  };
}

function supabaseRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    apikey: supabaseConfig.publishableKey,
    Authorization: `Bearer ${supabaseConfig.publishableKey}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const bodySize = options.body ? new Blob([options.body]).size : 0;
  const keepalive = options.keepalive ?? (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && bodySize < 60 * 1024);
  return fetch(`${supabaseConfig.url}/rest/v1/${path}`, { ...options, headers, keepalive }).then(async (response) => {
    const body = await response.text();
    if (!response.ok) throw new Error(`Supabase request failed with ${response.status}: ${body}`);
    return body ? JSON.parse(body) : null;
  });
}

function supabaseTaskApi(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const segments = path.split('/').filter(Boolean);
  const taskId = segments[2];
  const action = segments[3];
  const body = options.body ? JSON.parse(options.body) : {};

  if (path === '/api/tasks' && method === 'GET') {
    return supabaseRequest('cafe_tasks?select=*&order=task_order.asc').then((tasks) => ({ tasks: tasks.map(fromDatabaseTask) }));
  }
  if (path === '/api/tasks' && method === 'POST') {
    const task = {
      ...body,
      id: body.id || `task-${Date.now()}`,
      period: shiftOnlyCategories.includes(body.category) ? 'shift' : (body.period || 'weekly'),
      isActive: true,
      lastCompletedAt: null,
      area: body.area || 'General',
      order: Math.max(0, ...state.tasks.map((item) => Number(item.order) || 0)) + 1
    };
    return supabaseRequest('cafe_tasks', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDatabaseTask(task))
    }).then(([saved]) => ({ task: fromDatabaseTask(saved) }));
  }
  if (!taskId) return Promise.reject(new Error('Task id is required'));
  if (method === 'DELETE') {
    return supabaseRequest(`cafe_tasks?id=eq.${encodeURIComponent(taskId)}`, { method: 'DELETE' }).then(() => ({ deleted: true }));
  }
  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing) return Promise.reject(new Error('Task not found'));
  let nextTask;
  if (method === 'PUT') {
    nextTask = { ...existing, ...body, period: shiftOnlyCategories.includes(body.category) ? 'shift' : (body.period || existing.period) };
  } else if (method === 'POST' && action === 'complete') {
    nextTask = { ...existing, lastCompletedAt: new Date().toISOString() };
  } else if (method === 'POST' && action === 'reopen') {
    nextTask = { ...existing, lastCompletedAt: null, checklist: uncheckedChecklist(existing.checklist) };
  } else {
    return Promise.reject(new Error('Unsupported task action'));
  }
  return supabaseRequest(`cafe_tasks?id=eq.${encodeURIComponent(taskId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(toDatabaseTask(nextTask))
  }).then(([saved]) => ({ task: fromDatabaseTask(saved) }));
}

function api(path, options = {}) {
  if (usesSupabase && path.startsWith('/api/tasks')) return supabaseTaskApi(path, options);
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
    case 'shift':
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

function isCompletedToday(task, now) {
  if (!task.lastCompletedAt) return false;
  const completedAt = new Date(task.lastCompletedAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return completedAt >= startOfToday && completedAt <= endOfToday;
}

function getCurrentDayLabel(now) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
}

function isUrgentTask(task, now) {
  const dayName = getCurrentDayLabel(now);
  return Array.isArray(task.urgentOn) && task.urgentOn.includes(dayName);
}

function hasCheckedChecklistItems(task) {
  return normalizeChecklist(task.checklist).some((item) => item.checked);
}

function uncheckedChecklist(checklist) {
  return normalizeChecklist(checklist).map((item) => ({ ...item, checked: false }));
}

function checklistNeedsCycleReset(task, now) {
  return Boolean(task.lastCompletedAt)
    && !isCompletedInCurrentCycle(task, now)
    && hasCheckedChecklistItems(task);
}

function buildTaskPayload(tasks, now = new Date()) {
  const available = [];
  const completed = [];

  const sortedTasks = tasks.map((task) => ({
    ...task,
    checklist: checklistNeedsCycleReset(task, now) ? uncheckedChecklist(task.checklist) : normalizeChecklist(task.checklist),
    season: normalizeSeason(task.season)
  })).sort((a, b) => {
    const byPeriod = (taskPeriods.indexOf(a.period) >= 0 ? taskPeriods.indexOf(a.period) : 99) - (taskPeriods.indexOf(b.period) >= 0 ? taskPeriods.indexOf(b.period) : 99);
    if (byPeriod !== 0) return byPeriod;

    const byCategory = (taskCategories.indexOf(a.category) >= 0 ? taskCategories.indexOf(a.category) : 99) - (taskCategories.indexOf(b.category) >= 0 ? taskCategories.indexOf(b.category) : 99);
    if (byCategory !== 0) return byCategory;

    return (a.order ?? 999) - (b.order ?? 999);
  });

  for (const task of sortedTasks) {
    if (task.isActive === false || !taskMatchesSeason(task)) continue;

    const resultTask = {
      ...task,
      urgentToday: isUrgentTask(task, now)
    };

    const completedForToday = resultTask.urgentToday && isCompletedToday(task, now);
    if (isCompletedInCurrentCycle(task, now) && (!resultTask.urgentToday || completedForToday)) {
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
  return { date, taskIds: [], customItems: [], updatedAt: null };
}

function normalizeDayList(value, date) {
  return {
    date,
    taskIds: Array.isArray(value?.taskIds) ? [...new Set(value.taskIds.filter(Boolean))] : [],
    customItems: Array.isArray(value?.customItems)
      ? value.customItems.filter((item) => item?.title).map((item) => ({ id: item.id || `custom-${Date.now()}`, title: String(item.title).trim() }))
      : [],
    updatedAt: value?.updatedAt || value?.updated_at || null
  };
}

function getDayListsState() {
  if (state.dayLists) return state.dayLists;
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
    state.dayLists = result;
    return result;
  } catch (error) {
    state.dayLists = { today: emptyDayList(localDateKey()), tomorrow: emptyDayList(nextLocalDateKey()) };
    return state.dayLists;
  }
}

function saveTodayListState(taskIds) {
  const lists = getDayListsState();
  lists.today.taskIds = [...new Set(taskIds)];
  saveDayListsState(lists);
}

function saveDayListsState(lists) {
  const savedAt = new Date().toISOString();
  ['today', 'tomorrow'].forEach((day) => { lists[day].updatedAt = savedAt; });
  state.dayLists = lists;
  dayListRevision += 1;
  const snapshot = JSON.parse(JSON.stringify(lists));
  try {
    localStorage.setItem(DAY_LISTS_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Could not update the device copy of the day lists', error);
  }
  if (usesSupabase) {
    dayListSyncQueue = dayListSyncQueue
      .catch(() => undefined)
      .then(() => Promise.all(['today', 'tomorrow'].map((day) => supabaseRequest('cafe_day_lists?on_conflict=list_date', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          list_date: snapshot[day].date,
          task_ids: snapshot[day].taskIds,
          custom_items: snapshot[day].customItems,
          updated_at: snapshot[day].updatedAt
        })
      }))));
    dayListSyncQueue.catch((error) => console.error('Failed to sync day lists', error));
  }
  return dayListSyncQueue;
}

async function loadDayLists() {
  if (!usesSupabase) return getDayListsState();
  const revisionAtStart = dayListRevision;
  const todayDate = localDateKey();
  const tomorrowDate = nextLocalDateKey();
  const localLists = getDayListsState();
  const rows = await supabaseRequest(`cafe_day_lists?select=*&list_date=in.(${todayDate},${tomorrowDate})`);
  if (revisionAtStart !== dayListRevision) return getDayListsState();
  const byDate = new Map(rows.map((row) => [row.list_date, row]));
  const todayRow = byDate.get(todayDate);
  const tomorrowRow = byDate.get(tomorrowDate);
  const localTodayIsNewer = Boolean(localLists.today.updatedAt)
    && (!todayRow || new Date(localLists.today.updatedAt) > new Date(todayRow.updated_at));
  const localTomorrowIsNewer = Boolean(localLists.tomorrow.updatedAt)
    && (!tomorrowRow || new Date(localLists.tomorrow.updatedAt) > new Date(tomorrowRow.updated_at));
  const result = {
    today: normalizeDayList({
      taskIds: todayRow && !localTodayIsNewer ? todayRow.task_ids : localLists.today.taskIds,
      customItems: todayRow && !localTodayIsNewer ? todayRow.custom_items : localLists.today.customItems,
      updatedAt: todayRow && !localTodayIsNewer ? todayRow.updated_at : localLists.today.updatedAt
    }, todayDate),
    tomorrow: normalizeDayList({
      taskIds: tomorrowRow && !localTomorrowIsNewer ? tomorrowRow.task_ids : localLists.tomorrow.taskIds,
      customItems: tomorrowRow && !localTomorrowIsNewer ? tomorrowRow.custom_items : localLists.tomorrow.customItems,
      updatedAt: tomorrowRow && !localTomorrowIsNewer ? tomorrowRow.updated_at : localLists.tomorrow.updatedAt
    }, tomorrowDate)
  };
  state.dayLists = result;
  localStorage.setItem(DAY_LISTS_KEY, JSON.stringify(result));
  if (!todayRow || !tomorrowRow || localTodayIsNewer || localTomorrowIsNewer) saveDayListsState(result);
  return result;
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
  if (day === 'today') recordMilestoneTask(customId);
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

function renderTaskDetails(task) {
  const checklist = normalizeChecklist(task.checklist);
  const detailsLabel = checklist.length
    ? `Checklist <span>${checklist.filter((item) => item.checked).length}/${checklist.length}</span>`
    : 'Details';
  const checklistMarkup = (checklist.length || task.checklistImage) ? `
    <details class="task-details task-checklist">
      <summary>${detailsLabel}</summary>
      <div class="task-checklist-content">
        <div class="checklist-items">
          ${checklist.map((item, index) => `
            <label class="checklist-item ${item.checked ? 'is-checked' : ''}">
              <input type="checkbox" data-checklist-task-id="${escapeHtml(task.id)}" data-checklist-index="${index}" ${item.checked ? 'checked' : ''} />
              <span>${escapeHtml(item.text)}</span>
            </label>
          `).join('')}
        </div>
        ${task.checklistImage ? `<img class="checklist-reference-image" src="${escapeHtml(task.checklistImage)}" alt="Checklist reference" />` : ''}
      </div>
    </details>
  ` : '';
  const descriptionMarkup = task.description ? `
    <details class="task-details">
      <summary>Details</summary>
      <p>${escapeHtml(task.description)}</p>
    </details>
  ` : '';
  return `${checklistMarkup}${descriptionMarkup}`;
}

function matchingTaskTitles(tasks, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalizedQuery
    ? tasks.filter((task) => task.title.toLocaleLowerCase().includes(normalizedQuery))
    : [];
}

function bindTaskSearch(root, { inputSelector, suggestionsSelector, tasks, valueKey, onSelect }) {
  const input = root.querySelector(inputSelector);
  const suggestions = root.querySelector(suggestionsSelector);
  if (!input || !suggestions) return;
  input.taskSearchConfig = { tasks, valueKey, onSelect };
  if (input.dataset.taskSearchBound === 'true') return;
  input.dataset.taskSearchBound = 'true';

  const renderSuggestions = () => {
    const config = input.taskSearchConfig;
    const matches = matchingTaskTitles(config.tasks, input.value).slice(0, 8);
    suggestions.hidden = !matches.length;
    root.classList.toggle('has-active-suggestions', matches.length > 0);
    suggestions.innerHTML = matches.map((task) => `
      <button type="button" class="quick-day-suggestion" role="option" data-task-search-id="${task.id}">
        <span>${escapeHtml(task.title)}</span>
        <span class="meta-pill category-pill">${categoryTagLabel(task.category)}</span>
      </button>
    `).join('');
    suggestions.querySelectorAll('[data-task-search-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const task = config.tasks.find((item) => item.id === button.dataset.taskSearchId);
        if (task) config.onSelect(task);
      });
    });
  };

  input.addEventListener('input', () => {
    const config = input.taskSearchConfig;
    state[config.valueKey] = input.value;
    if (!input.value.trim()) config.onSelect(null);
    else renderSuggestions();
  });
  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      suggestions.hidden = true;
      root.classList.remove('has-active-suggestions');
    }
  });
  input.closest('.quick-day-combobox')?.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!input.closest('.quick-day-combobox').contains(document.activeElement)) {
        suggestions.hidden = true;
        root.classList.remove('has-active-suggestions');
      }
    }, 0);
  });
}

function renderGroups() {
  const root = document.getElementById('taskGroups');
  if (!root) return;

  const homeSortMode = getAvailableSortMode();
  const allHomeTasks = sortAvailableTasks(
    state.available.filter((task) => !['opening', 'closing'].includes(task.category)),
    homeSortMode
  );
  const homeTasks = state.availableSearch.trim()
    ? allHomeTasks.filter((task) => task.title.toLocaleLowerCase().includes(state.availableSearch.trim().toLocaleLowerCase()))
    : allHomeTasks;
  const todayTaskIds = new Set(getTodayListState().taskIds);
  const tomorrowTaskIds = new Set(getDayListsState().tomorrow.taskIds);

  if (!homeTasks.length) {
    root.innerHTML = `
      <div class="panel-card">
        <div class="list-title-row">
          <div class="available-title"><h2>Available Tasks</h2><span class="group-badge">0 open</span></div>
        </div>
        <div class="empty-state">No available tasks right now. Everything is complete for this cycle.</div>
      </div>
    `;
    return;
  }

  const renderHomeTask = (task) => `
    <div class="task-swipe-shell" data-task-id="${task.id}" data-swipe-mode="both">
      <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
      <button class="task-swipe-action tomorrow" type="button" data-swipe-tomorrow aria-label="Add ${escapeHtml(task.title)} to tomorrow">Tomorrow</button>
      <article class="task-item task-swipe-content task-item-no-check ${task.urgentToday ? 'urgent' : ''} ${tomorrowTaskIds.has(task.id) ? 'scheduled-tomorrow' : ''}">
        <div class="task-main">
          <h4>${escapeHtml(task.title)}</h4>
          ${renderTaskDetails(task)}
          <div class="task-meta">
            <span class="meta-pill category-pill">${categoryTagLabel(task.category)}</span>
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
  `;
  const urgentTasks = homeTasks.filter((task) => task.urgentToday);
  const regularTasks = homeTasks.filter((task) => !task.urgentToday);
  const urgentMarkup = urgentTasks.length ? `
    <section class="available-type-group urgent-task-group">
      <div class="available-type-heading">
        <h3>Urgent Today</h3>
        <span class="group-badge">${urgentTasks.length}</span>
      </div>
      <div class="task-list">${urgentTasks.map(renderHomeTask).join('')}</div>
    </section>
  ` : '';
  const groupedTaskMarkup = homeSortMode === 'type'
    ? `<div class="available-type-groups">${taskCategories
      .filter((category) => regularTasks.some((task) => task.category === category))
      .map((category) => {
        const categoryTasks = regularTasks.filter((task) => task.category === category);
        return `
          <section class="available-type-group">
            <div class="available-type-heading">
              <h3>${categoryLabels[category]}</h3>
              <span class="group-badge">${categoryTasks.length}</span>
            </div>
            <div class="task-list">${categoryTasks.map(renderHomeTask).join('')}</div>
          </section>
        `;
      }).join('')}</div>`
    : `<div class="available-time-groups">${taskPeriods
      .filter((period) => regularTasks.some((task) => task.period === period))
      .map((period) => {
        const periodTasks = regularTasks.filter((task) => task.period === period);
        return `
          <section class="available-time-group">
            <div class="available-type-heading">
              <h3>${periodLabels[period]}</h3>
              <span class="group-badge">${periodTasks.length}</span>
            </div>
            <div class="task-list">${periodTasks.map(renderHomeTask).join('')}</div>
          </section>
        `;
      }).join('')}</div>`;
  const homeTaskMarkup = `<div class="available-home-groups">${urgentMarkup}${groupedTaskMarkup}</div>`;

  root.innerHTML = `
    <div class="panel-card">
      <div class="list-title-row">
        <div class="available-title"><h2>Available Tasks</h2><span class="group-badge">${homeTasks.length} open</span></div>
        <div class="available-controls">
          <div class="quick-day-combobox task-search-combobox">
            <input type="search" data-available-search value="${escapeHtml(state.availableSearch)}" placeholder="Search tasks…" aria-label="Search available tasks" aria-autocomplete="list" autocomplete="off" />
            <div class="quick-day-suggestions" data-available-suggestions role="listbox" hidden></div>
          </div>
          <button class="sort-toggle ${homeSortMode === 'time' ? 'is-time' : ''}" type="button" data-home-sort aria-label="Switch available-task sorting. Currently sorted by ${homeSortMode}.">
            <span class="sort-option">Type</span>
            <span class="sort-option">Time</span>
          </button>
        </div>
      </div>
      ${homeTaskMarkup}
    </div>
  `;

  bindInlineEditButtons();
  bindTaskSearch(root, {
    inputSelector: '[data-available-search]',
    suggestionsSelector: '[data-available-suggestions]',
    tasks: allHomeTasks,
    valueKey: 'availableSearch',
    onSelect: (task) => {
      state.availableSearch = task?.title || '';
      renderGroups();
    }
  });

  root.querySelector('[data-home-sort]')?.addEventListener('click', (event) => {
    const sortToggle = event.currentTarget;
    const nextSortMode = homeSortMode === 'time' ? 'type' : 'time';
    sortToggle.disabled = true;
    sortToggle.classList.toggle('is-time', nextSortMode === 'time');
    sortToggle.setAttribute('aria-label', `Switch available-task sorting. Currently sorted by ${nextSortMode}.`);

    window.setTimeout(() => {
      try {
        localStorage.setItem('cafe-palmier-available-sort', nextSortMode);
      } catch (error) {
        // Sorting remains available for the current view if storage is unavailable.
      }
      renderGroups();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
  });

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
    .filter((task) => task.isActive && taskMatchesSeason(task));
  const label = day === 'today' ? "Today's List" : "Tomorrow's List";

  root.innerHTML = `
    <div class="list-title-row"><h2>${label}</h2><span class="group-badge">${dayTasks.length + customItems.length}</span></div>
    <form class="quick-day-form" data-quick-day="${day}">
      <div class="quick-day-combobox">
        <input name="title" type="text" placeholder="Write an additional task…" aria-label="Additional task for ${day}" aria-autocomplete="list" aria-controls="${day}TaskSuggestions" autocomplete="off" required />
        <div id="${day}TaskSuggestions" class="quick-day-suggestions" role="listbox" hidden></div>
      </div>
      <button class="primary-btn" type="submit" disabled>Add</button>
    </form>
    ${dayTasks.length || customItems.length
      ? `
        <div class="task-list today-task-list">
          ${dayTasks.map((task) => `
            <div class="task-swipe-shell" data-task-id="${task.id}" data-swipe-mode="${day === 'today' ? 'complete' : 'none'}">
              ${day === 'today' ? `<button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>` : ''}
              <article class="task-item task-swipe-content task-item-no-check ${task.urgentToday ? 'urgent' : ''} ${day === 'tomorrow' ? 'scheduled-tomorrow' : ''}">
                <div class="task-main"><h4>${escapeHtml(task.title)}</h4>${renderTaskDetails(task)}</div>
                <div class="task-actions">
                  <button class="icon-btn" data-edit-id="${task.id}">Edit</button>
                  <button class="icon-btn" data-remove-day-id="${task.id}" data-day="${day}">Remove</button>
                </div>
              </article>
            </div>
          `).join('')}
          ${customItems.map((item) => `
            <article class="task-item task-item-no-check one-off-item ${day === 'tomorrow' ? 'scheduled-tomorrow' : ''}">
              <div class="task-main"><h4>${escapeHtml(item.title)}</h4><span class="meta-pill category-pill">One-off</span></div>
              <button class="icon-btn" data-remove-custom-id="${item.id}" data-day="${day}">${day === 'today' ? 'Done' : 'Remove'}</button>
            </article>
          `).join('')}
        </div>
      `
      : `<div class="today-empty"><p>No tasks added yet.</p></div>`}
  `;

  const quickDayForm = root.querySelector('[data-quick-day]');
  const quickDayInput = quickDayForm?.elements.title;
  const quickDayButton = quickDayForm?.querySelector('[type="submit"]');
  const suggestions = quickDayForm?.querySelector('.quick-day-suggestions');
  const updateQuickDayButton = () => {
    if (quickDayButton && quickDayInput) quickDayButton.disabled = !quickDayInput.value.trim();
  };
  const renderSuggestions = () => {
    if (!quickDayInput || !suggestions) return;
    const matches = getAvailableTasksForDayList(taskIds, quickDayInput.value).slice(0, 6);
    suggestions.hidden = !matches.length;
    root.classList.toggle('has-active-suggestions', matches.length > 0);
    suggestions.innerHTML = matches.map((task) => `
      <button type="button" class="quick-day-suggestion" role="option" data-suggest-task-id="${task.id}">
        <span>${escapeHtml(task.title)}</span>
        <span class="meta-pill category-pill">${categoryTagLabel(task.category)}</span>
      </button>
    `).join('');
    suggestions.querySelectorAll('[data-suggest-task-id]').forEach((button) => {
      button.addEventListener('click', () => addTaskToDay(button.dataset.suggestTaskId, day));
    });
  };
  quickDayInput?.addEventListener('input', () => {
    updateQuickDayButton();
    renderSuggestions();
  });
  quickDayInput?.addEventListener('focus', renderSuggestions);
  quickDayInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && suggestions) {
      suggestions.hidden = true;
      root.classList.remove('has-active-suggestions');
    }
  });
  quickDayForm?.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (suggestions && !quickDayForm.contains(document.activeElement)) {
        suggestions.hidden = true;
        root.classList.remove('has-active-suggestions');
      }
    }, 0);
  });
  updateQuickDayButton();

  quickDayForm?.addEventListener('submit', (event) => {
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
    ${renderListProgress(openingCompleted.length, openingAvailable.length, 'opening')}
    ${openingAvailable.length ? `<div class="opening-groups">${[...openingStages, 'unassigned'].map((stage) => {
      const stageTasks = openingAvailable.filter((task) => stage === 'unassigned'
        ? !openingStages.includes(task.timeTag)
        : task.timeTag === stage);
      if (stage === 'unassigned' && !stageTasks.length) return '';
      const stageLabel = stage === 'unassigned' ? 'Not assigned yet' : openingStageLabels[stage];
      return `<section class="opening-group">
        <div class="opening-group-heading"><h3>${stageLabel}</h3><span class="group-badge">${stageTasks.length}</span></div>
        ${stageTasks.length ? `<div class="task-list">${stageTasks.map((task) => `
        <div class="task-swipe-shell" data-task-id="${task.id}">
          <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
          <article class="task-item task-swipe-content task-item-no-check">
            <div class="task-main"><h4>${escapeHtml(task.title)}</h4>${renderTaskDetails(task)}</div>
            <div class="task-actions"><button class="icon-btn" data-edit-id="${task.id}">Edit</button></div>
          </article>
        </div>
      `).join('')}</div>` : '<div class="empty-state">No tasks assigned yet.</div>'}
      </section>`;
    }).join('')}</div>` : '<div class="empty-state">Opening is complete for today.</div>'}
  `;

  bindInlineEditButtons(root);
  bindListProgressButtons(root);
  attachSwipeHandlers(root);
}

function getEncouragementMessage(seed = '') {
  let hash = 0;
  for (const character of String(seed)) {
    hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  }
  return encouragementMessages[hash % encouragementMessages.length];
}

function getProgressMessage(completed, remaining, category = '') {
  return getEncouragementMessage(`${localDateKey()}-${category}-${completed}-${remaining}`);
}

function renderListProgress(completed, remaining, category) {
  const total = completed + remaining;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  return `
    <button type="button" class="list-progress sticky-progress" data-open-list-completed="${category}" aria-label="${completed} completed, ${remaining} remaining. View completed tasks.">
      <div class="progress-counts">
        <span><strong>${completed}</strong> completed</span>
        <span><strong>${remaining}</strong> left</span>
      </div>
      <div class="progress-track" aria-hidden="true"><span style="width: ${percentage}%"></span></div>
      <p class="progress-message">${getProgressMessage(completed, remaining, category)}</p>
    </button>
  `;
}

function bindListProgressButtons(scope = document) {
  scope.querySelectorAll('[data-open-list-completed]').forEach((button) => {
    button.addEventListener('click', () => openCompletedModal(button.dataset.openListCompleted));
  });
}

function openCompletedModal(filterValue = '', filterType = 'category') {
  const modal = document.getElementById('completedModal');
  if (!modal) return;

  state.completedFilter = filterValue ? { type: filterType, value: filterValue } : null;
  state.completedSearch = '';
  const heading = modal.querySelector('.modal-header h2');
  if (heading) {
    const filterLabel = filterType === 'period'
      ? periodLabels[filterValue]
      : categoryLabels[filterValue];
    heading.textContent = filterValue ? `Completed ${filterLabel || filterValue} Tasks` : 'Completed Tasks';
  }
  renderCompleted();
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
  const allCompletedTasks = state.completedFilter
    ? state.completed.filter((task) => task[state.completedFilter.type] === state.completedFilter.value)
    : state.completed.filter((task) => !shiftOnlyCategories.includes(task.category));
  const completedTasks = state.completedSearch.trim()
    ? allCompletedTasks.filter((task) => task.title.toLocaleLowerCase().includes(state.completedSearch.trim().toLocaleLowerCase()))
    : allCompletedTasks;

  const modal = document.getElementById('completedModal');
  if (modal) {
    const searchInput = modal.querySelector('[data-completed-search]');
    if (searchInput) searchInput.value = state.completedSearch;
    bindTaskSearch(modal, {
      inputSelector: '[data-completed-search]',
      suggestionsSelector: '[data-completed-suggestions]',
      tasks: allCompletedTasks,
      valueKey: 'completedSearch',
      onSelect: (task) => {
        state.completedSearch = task?.title || '';
        renderCompleted();
      }
    });
  }

  if (!completedTasks.length) {
    root.innerHTML = '<li class="empty-state">No completed items yet</li>';
    return;
  }

  root.innerHTML = completedTasks.map((task) => `
    <li>
      <div class="completed-task-info">
        <strong>${escapeHtml(task.title)}</strong>
        <time datetime="${escapeHtml(task.lastCompletedAt || '')}">Completed ${formatCompletedAt(task.lastCompletedAt)}</time>
      </div>
      <button class="icon-btn" data-reopen-id="${task.id}">Reopen</button>
    </li>
  `).join('');

  root.querySelectorAll('[data-reopen-id]').forEach((button) => {
    button.addEventListener('click', () => reopenTask(button.dataset.reopenId));
  });
}

function formatCompletedAt(value) {
  if (!value) return 'date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function getCalendarProgress(period, now = new Date()) {
  if (period === 'weekly') {
    const dayOfWeek = now.getDay();
    const position = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5);
    const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
    return {
      position,
      total: 5,
      label,
      ariaLabel: `${label}: ${position} of 5 weekdays reached`
    };
  }

  if (period === 'monthly') {
    const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const position = now.getDate();
    const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(now);
    return {
      position,
      total,
      label,
      ariaLabel: `${label}: day ${position} of ${total}`
    };
  }

  const startOfCurrentYear = Date.UTC(now.getFullYear(), 0, 1);
  const startOfCurrentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const position = Math.floor((startOfCurrentDay - startOfCurrentYear) / (24 * 60 * 60 * 1000)) + 1;
  const total = Math.round((Date.UTC(now.getFullYear() + 1, 0, 1) - startOfCurrentYear) / (24 * 60 * 60 * 1000));
  return {
    position,
    total,
    label: String(now.getFullYear()),
    ariaLabel: `Day ${position} of ${total} in ${now.getFullYear()}`
  };
}

function renderCalendarProgress(period, now = new Date()) {
  const progress = getCalendarProgress(period, now);
  const percentage = (progress.position / progress.total) * 100;
  const progressBar = period === 'yearly'
    ? `<div class="calendar-progress-track" aria-hidden="true"><span style="width: ${percentage}%"></span></div>`
    : `<div class="calendar-progress-steps" style="--calendar-step-count: ${progress.total}" aria-hidden="true">${Array.from({ length: progress.total }, (_, index) => (
      `<span class="calendar-progress-step ${index < progress.position ? 'is-reached' : ''}"></span>`
    )).join('')}</div>`;

  return `
    <div class="calendar-progress" role="img" aria-label="${escapeHtml(progress.ariaLabel)}">
      <div class="calendar-progress-heading"><span>${escapeHtml(progress.label)}</span><strong>${progress.position}/${progress.total}</strong></div>
      ${progressBar}
    </div>
  `;
}

function renderPeriodProgress() {
  const root = document.getElementById('periodProgress');
  if (!root) return;
  const now = new Date();

  root.innerHTML = ['weekly', 'monthly', 'yearly'].map((period) => {
    const completed = state.completed.filter((task) => task.period === period && !shiftOnlyCategories.includes(task.category)).length;
    const remaining = state.available.filter((task) => task.period === period && !shiftOnlyCategories.includes(task.category)).length;
    const total = completed + remaining;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    const calendarProgress = getCalendarProgress(period, now);
    return `
      <button type="button" class="period-progress-card ${period}" data-open-period-completed="${period}" aria-label="${periodLabels[period]}: ${completed} of ${total} completed. ${escapeHtml(calendarProgress.ariaLabel)}. View completed tasks.">
        <div class="period-progress-heading">
          <strong>${periodLabels[period]}</strong>
          <span>${completed}/${total}</span>
        </div>
        <div class="progress-track" aria-hidden="true"><span style="width: ${percentage}%"></span></div>
        ${renderCalendarProgress(period, now)}
        <p>${getProgressMessage(completed, remaining, period)}</p>
      </button>
    `;
  }).join('');

  root.querySelectorAll('[data-open-period-completed]').forEach((button) => {
    button.addEventListener('click', () => openCompletedModal(button.dataset.openPeriodCompleted, 'period'));
  });
}

function getClosingSortMode() {
  try {
    return localStorage.getItem('cafe-palmier-closing-sort') === 'time' ? 'time' : 'area';
  } catch (error) {
    return 'area';
  }
}

function getAvailableSortMode() {
  try {
    return localStorage.getItem('cafe-palmier-available-sort') === 'time' ? 'time' : 'type';
  } catch (error) {
    return 'type';
  }
}

function sortAvailableTasks(tasks, sortMode) {
  return [...tasks].sort((first, second) => {
    const categoryDifference = taskCategories.indexOf(first.category) - taskCategories.indexOf(second.category);
    const timeDifference = getTimeTagOrder(first.timeTag) - getTimeTagOrder(second.timeTag);
    const primaryDifference = sortMode === 'time' ? timeDifference : categoryDifference;
    const secondaryDifference = sortMode === 'time' ? categoryDifference : timeDifference;
    if (primaryDifference !== 0) return primaryDifference;
    if (secondaryDifference !== 0) return secondaryDifference;
    return first.title.localeCompare(second.title);
  });
}

function getTimeTagOrder(timeTag) {
  const match = String(timeTag || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + Number(match[2]);
}

function getClosingTimeTagOrder(timeTag) {
  return timeTag === 'Any time' || !timeTag ? -1 : getTimeTagOrder(timeTag);
}

function belongsOnClosingList(task) {
  return task.category === 'closing' || task.urgentToday;
}

function getClosingTimeGroup(task) {
  return task.urgentToday ? 'Any time' : (task.timeTag || 'Any time');
}

function renderClosingTask(task, showAreaTag) {
  return `
    <div class="task-swipe-shell" data-task-id="${task.id}">
      <button class="task-swipe-action" type="button" data-swipe-complete aria-label="Complete ${escapeHtml(task.title)}">Complete</button>
      <article class="task-item task-swipe-content task-item-no-check ${task.urgentToday ? 'urgent' : ''}">
        <div class="task-main">
          <h4>${escapeHtml(task.title)}</h4>
          ${task.urgentToday ? '<span class="meta-pill urgent">Urgent today</span>' : ''}
          ${showAreaTag
            ? `<span class="meta-pill area-pill">${escapeHtml(task.area || 'General')}</span>`
            : (task.timeTag ? `<span class="time-pill">${escapeHtml(task.timeTag)}</span>` : '')}
          ${renderTaskDetails(task)}
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

  const closingAvailable = state.available.filter(belongsOnClosingList);
  const closingCompleted = state.completed.filter(belongsOnClosingList);
  const sortMode = getClosingSortMode();

  let availableMarkup = '';
  if (sortMode === 'time') {
    const timeGroups = closingAvailable.reduce((groups, task) => {
      const key = getClosingTimeGroup(task);
      groups[key] ||= {};
      const area = task.area || 'General';
      groups[key][area] ||= [];
      groups[key][area].push(task);
      return groups;
    }, {});

    availableMarkup = Object.entries(timeGroups)
      .sort(([first], [second]) => getClosingTimeTagOrder(first) - getClosingTimeTagOrder(second) || first.localeCompare(second))
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

  root.innerHTML = `
    <div class="closing-stack">
      <div class="panel-card">
        <div class="list-title-row">
          <h2>Closing list</h2>
          <button class="secondary-btn" type="button" data-closing-sort aria-pressed="${sortMode === 'time'}">${sortMode === 'time' ? 'Sort by section' : 'Sort by time'}</button>
        </div>
        ${renderListProgress(closingCompleted.length, closingAvailable.length, 'closing')}
        <div class="closing-groups ${sortMode === 'time' ? 'closing-groups-by-time' : ''}">${availableMarkup || '<div class="empty-state">No closing tasks available right now.</div>'}</div>
      </div>
    </div>
  `;

  bindInlineEditButtons(root);
  bindListProgressButtons(root);

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
                      <span>${seasonLabels[normalizeSeason(task.season)]}</span>
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
  if (usesSupabase) {
    const cachedTasks = getLocalTasks([]);
    if (cachedTasks.length) {
      const cachedPayload = buildTaskPayload(cachedTasks, new Date());
      state.tasks = cachedPayload.tasks;
      state.available = cachedPayload.available;
      state.completed = cachedPayload.completed;
      getDayListsState();
      renderAll();
    }
  }
  try {
    let data = await api('/api/tasks');
    let tasks = Array.isArray(data.tasks) ? data.tasks : [];
    if (usesSupabase && !tasks.length) {
      const starterData = await fetch(STATIC_TASKS_PATH).then((response) => response.json());
      const starterTasks = getLocalTasks(Array.isArray(starterData.tasks) ? starterData.tasks : []);
      await Promise.all(starterTasks.map((task) => supabaseRequest('cafe_tasks?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(toDatabaseTask(task))
      })));
      data = await api('/api/tasks');
      tasks = data.tasks;
    }
    const now = new Date();
    const checklistResetIds = tasks.filter((task) => checklistNeedsCycleReset(task, now)).map((task) => task.id);
    const payload = buildTaskPayload(tasks, now);

    state.tasks = payload.tasks || tasks;
    state.available = payload.available || [];
    state.completed = payload.completed || [];
    if (usesSupabase) saveLocalTasks(state.tasks);
    if (checklistResetIds.length) {
      saveLocalTasks(state.tasks);
      try {
        await Promise.all(checklistResetIds.map((taskId) => {
          const resetTask = state.tasks.find((task) => task.id === taskId);
          return resetTask
            ? api(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(resetTask) })
            : Promise.resolve();
        }));
      } catch (checklistResetError) {
        console.warn('Checklist resets will be retried the next time tasks load', checklistResetError);
      }
    }
    getDayListsState();
    renderAll();
    try {
      await loadDayLists();
    } catch (dayListError) {
      console.warn('Using the saved day lists while cloud sync reconnects', dayListError);
    }
    ensureUrgentTasksInToday();
    renderAll();
  } catch (error) {
    console.error('Failed to load tasks', error);
    try {
      const fallbackData = await fetch(STATIC_TASKS_PATH).then((response) => {
        if (!response.ok) throw new Error(`Fallback request failed with ${response.status}`);
        return response.json();
      });
      const fallbackTasks = getLocalTasks(Array.isArray(fallbackData.tasks) ? fallbackData.tasks : []);
      const fallbackPayload = buildTaskPayload(fallbackTasks, new Date());
      state.tasks = fallbackPayload.tasks;
      state.available = fallbackPayload.available;
      state.completed = fallbackPayload.completed;
      getDayListsState();
      ensureUrgentTasksInToday();
      renderAll();
    } catch (fallbackError) {
      console.error('Failed to load fallback tasks', fallbackError);
      document.querySelectorAll('#taskGroups, #todayList, #tomorrowList, #openingList, #closingList').forEach((root) => {
        root.innerHTML = '<div class="empty-state">Could not load tasks. Check the connection and refresh.</div>';
      });
    }
  }
}

async function completeTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  const previousCompletedAt = task?.lastCompletedAt || null;
  const countsTowardMilestone = ['home', 'today'].includes(state.page)
    && task
    && !shiftOnlyCategories.includes(task.category);
  try {
    if (task) {
      task.lastCompletedAt = new Date().toISOString();
      const payload = buildTaskPayload(state.tasks, new Date());
      state.tasks = payload.tasks;
      state.available = payload.available;
      state.completed = payload.completed;
      saveLocalTasks(state.tasks);
    }
    const lists = getDayListsState();
    lists.today.taskIds = lists.today.taskIds.filter((id) => id !== taskId);
    saveDayListsState(lists);
    renderAll();
    const finishedClosingList = state.page === 'closing'
      && task
      && belongsOnClosingList(task)
      && !state.available.some(belongsOnClosingList);
    await api(`/api/tasks/${taskId}/complete`, { method: 'POST' });
    if (finishedClosingList) {
      openClosingCompleteModal();
    } else if (countsTowardMilestone) {
      recordMilestoneTask(taskId);
    }
  } catch (error) {
    console.error('Failed to complete task', error);
    if (task) {
      task.lastCompletedAt = previousCompletedAt;
      saveLocalTasks(state.tasks);
    }
    await loadTaskData();
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
  form.elements.season.value = normalizeSeason(task.season);
  setUrgentDays(form, task.urgentOn || []);
  form.elements.timeTag.value = task.timeTag || '';
  setChecklistEditorItems(form, normalizeChecklist(task.checklist).length
    ? task.checklist
    : checklistFromText(task.description));
  setChecklistEditorImage(form, task.checklistImage || '');
  const deleteButton = document.getElementById('deleteTaskButton');
  if (deleteButton) deleteButton.hidden = false;
  updatePeriodVisibility();
  openTaskModal();
}

function updatePeriodVisibility() {
  const form = document.getElementById('taskForm');
  const periodField = document.getElementById('periodField');
  if (!form || !periodField) return;

  const isShiftOnly = shiftOnlyCategories.includes(form.elements.category.value);
  periodField.hidden = isShiftOnly;
  form.elements.period.disabled = isShiftOnly;
  if (isShiftOnly) form.elements.period.value = 'shift';
  updateTimeTagOptions(form);
}

function resetForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.reset();
  updateUrgentDaysSummary(form);
  form.querySelector('[data-urgent-dropdown]')?.removeAttribute('open');
  document.getElementById('formTitle').textContent = 'Add a task';
  form.elements.taskId.value = '';
  const deleteButton = document.getElementById('deleteTaskButton');
  if (deleteButton) deleteButton.hidden = true;
  updatePeriodVisibility();
  setChecklistEditorItems(form, []);
  setChecklistEditorImage(form, '');
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const existingTask = state.tasks.find((task) => task.id === form.elements.taskId.value);
  const payload = {
    title: form.elements.title.value.trim(),
    category: form.elements.category.value,
    period: shiftOnlyCategories.includes(form.elements.category.value) ? 'shift' : form.elements.period.value,
    season: normalizeSeason(form.elements.season.value),
    description: '',
    checklist: getChecklistEditorItems(form, existingTask?.checklist),
    checklistImage: form.elements.checklistImage?.value || '',
    timeTag: form.elements.timeTag.value.trim(),
    urgentOn: getSelectedUrgentDays(form)
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
  renderPeriodProgress();
  renderClosingList();
  renderAdminList();
  attachSwipeHandlers();
}

function initializeTaskCardDetails() {
  document.addEventListener('click', (event) => {
    const card = event.target.closest('.task-item');
    if (!card || event.target.closest('button, input, select, textarea, a, label')) return;

    const details = card.querySelector('.task-details');
    if (!details || event.target.closest('summary')) return;

    const swipeShell = card.closest('.task-swipe-shell');
    if (swipeShell?.dataset.suppressCardClick === 'true') return;
    details.open = !details.open;
  });
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
    let isCommitting = false;

    const resetPosition = () => {
      if (isCommitting) return;
      content.style.transition = 'transform 260ms cubic-bezier(.2,.8,.2,1)';
      content.style.transform = 'translate3d(0, 0, 0)';
      shell.classList.remove('revealed');
      shell.classList.remove('swipe-left', 'swipe-right');
      shell.classList.remove('ready-to-complete');
      dragOffset = 0;
      isDragging = false;
      directionLocked = false;
      isHorizontal = false;
    };

    const commitSwipe = (direction, action) => {
      if (isCommitting) return;
      isCommitting = true;
      isDragging = false;
      const distance = content.offsetWidth + 36;
      content.style.transition = 'none';
      content.style.transform = `translate3d(${direction === 'left' ? -distance : distance}px, 0, 0)`;
      action();
    };

    shell.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button, input, summary')) {
        return;
      }

      shell.dataset.suppressCardClick = 'false';
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
      const allowsTomorrow = swipeMode === 'both';
      dragOffset = Math.max(-128, Math.min(allowsTomorrow ? 128 : 0, deltaX));
      if (Math.abs(dragOffset) > 8) shell.dataset.suppressCardClick = 'true';
      content.style.transform = `translate3d(${dragOffset}px, 0, 0)`;
      shell.classList.toggle('revealed', Math.abs(dragOffset) > 8);
      shell.classList.toggle('swipe-left', dragOffset < -8);
      shell.classList.toggle('swipe-right', dragOffset > 8);
      shell.classList.toggle('ready-to-complete', Math.abs(dragOffset) >= 92);
    });

    shell.addEventListener('pointerup', () => {
      if (!isDragging) return;

      if (dragOffset <= -92) {
        commitSwipe('left', () => completeTask(taskId));
        return;
      }
      if (dragOffset >= 92 && swipeMode === 'both') {
        commitSwipe('right', () => addTaskToDay(taskId, 'tomorrow'));
        return;
      }
      resetPosition();
      window.setTimeout(() => { delete shell.dataset.suppressCardClick; }, 0);
    });

    shell.addEventListener('pointercancel', () => {
      resetPosition();
      delete shell.dataset.suppressCardClick;
    });
    shell.querySelector('[data-swipe-complete]')?.addEventListener('click', () => commitSwipe('left', () => completeTask(taskId)));
    shell.querySelector('[data-swipe-tomorrow]')?.addEventListener('click', () => commitSwipe('right', () => addTaskToDay(taskId, 'tomorrow')));
  });
}

function prefetchAppPages() {
  const currentUrl = new URL(window.location.href);
  const seen = new Set();
  const pageUrls = [];
  document.querySelectorAll('.nav-link, .brand-home').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) return;
    const url = new URL(href, currentUrl);
    if (url.href === currentUrl.href || seen.has(url.href)) return;
    seen.add(url.href);
    pageUrls.push(url.href);
    const preload = document.createElement('link');
    preload.rel = 'prefetch';
    preload.href = url.href;
    document.head.appendChild(preload);
  });

  if (pageUrls.length && HTMLScriptElement.supports?.('speculationrules')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prefetch: [{ source: 'list', urls: pageUrls, eagerness: 'immediate' }]
    });
    document.head.appendChild(rules);
  }
}

function initializeNavIndicator() {
  const nav = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav-link')];
  const activeLink = nav?.querySelector('.nav-link.active');
  if (!nav || !activeLink) return;
  let selectedLink = activeLink;

  activeLink.setAttribute('aria-current', 'page');
  const indicator = document.createElement('span');
  indicator.className = 'nav-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav.prepend(indicator);

  const moveIndicator = (link, animate = true) => {
    if (!animate) indicator.style.transition = 'none';
    nav.style.setProperty('--nav-indicator-x', `${link.offsetLeft}px`);
    nav.style.setProperty('--nav-indicator-y', `${link.offsetTop}px`);
    nav.style.setProperty('--nav-indicator-width', `${link.offsetWidth}px`);
    nav.style.setProperty('--nav-indicator-height', `${link.offsetHeight}px`);
    if (!animate) requestAnimationFrame(() => { indicator.style.transition = ''; });
  };

  moveIndicator(activeLink, false);
  nav.classList.add('nav-ready');
  if (nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = Math.max(0, activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2);
  }
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.href);
      if (link === selectedLink || url.href === window.location.href) {
        event.preventDefault();
        return;
      }
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      selectedLink.classList.remove('active');
      selectedLink.removeAttribute('aria-current');
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      selectedLink = link;
      nav.classList.add('is-switching');

      let hasNavigated = false;
      const finishNavigation = () => {
        if (hasNavigated) return;
        hasNavigated = true;
        window.location.assign(url.href);
      };
      const handleSlideEnd = (transitionEvent) => {
        if (transitionEvent.target !== indicator || transitionEvent.propertyName !== 'transform') return;
        indicator.removeEventListener('transitionend', handleSlideEnd);
        finishNavigation();
      };

      indicator.addEventListener('transitionend', handleSlideEnd);
      moveIndicator(link);
      window.setTimeout(finishNavigation, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
    });
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => moveIndicator(selectedLink, false)).observe(nav);
  } else {
    window.addEventListener('resize', () => moveIndicator(selectedLink, false));
  }
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
            <label id="periodField"><span>Period</span><select name="period"><option value="shift">Shift</option><option value="weekly" selected>Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
            <label><span>Season</span><select name="season"><option value="both" selected>Winter &amp; Summer</option><option value="winter">Winter</option><option value="summer">Summer</option></select></label>
            <label><span data-time-tag-label>Time tag</span><select name="timeTag">${timeTagOptions()}</select></label>
            ${urgentDaysFieldMarkup()}
          </div>
          ${checklistEditorMarkup()}
          <div class="form-actions"><button type="submit" class="primary-btn">Save task</button><button type="button" class="secondary-btn" id="resetForm">Clear form</button><button type="button" class="danger-btn" id="deleteTaskButton" hidden>Delete task</button></div>
        </form>
      </div>
    </div>`;
}

function urgentDaysFieldMarkup() {
  return `
    <div class="form-field urgent-days-field">
      <span>Urgent on</span>
      <details class="checkbox-dropdown" data-urgent-dropdown>
        <summary data-urgent-summary>No days selected</summary>
        <div class="checkbox-dropdown-menu">
          ${weekDays.map((day) => `<label><input type="checkbox" name="urgentOn" value="${day}" /><span>${day}</span></label>`).join('')}
        </div>
      </details>
    </div>`;
}

function getSelectedUrgentDays(form) {
  return [...form.querySelectorAll('input[name="urgentOn"]:checked')].map((input) => input.value);
}

function updateUrgentDaysSummary(form) {
  const summary = form?.querySelector('[data-urgent-summary]');
  if (!summary) return;
  const selectedDays = getSelectedUrgentDays(form);
  summary.textContent = selectedDays.length > 2
    ? `${selectedDays.length} days selected`
    : (selectedDays.join(', ') || 'No days selected');
}

function setUrgentDays(form, selectedDays) {
  const selected = new Set(selectedDays);
  form.querySelectorAll('input[name="urgentOn"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
  updateUrgentDaysSummary(form);
}

function initializeUrgentDayDropdowns() {
  document.querySelectorAll('[data-urgent-dropdown]').forEach((dropdown) => {
    const form = dropdown.closest('form');
    dropdown.querySelectorAll('input[name="urgentOn"]').forEach((input) => {
      input.addEventListener('change', () => updateUrgentDaysSummary(form));
    });
    updateUrgentDaysSummary(form);
  });
  if (!urgentDropdownDismissalBound) {
    urgentDropdownDismissalBound = true;
    const closeDropdownsOutside = (event) => {
      document.querySelectorAll('[data-urgent-dropdown][open]').forEach((dropdown) => {
        if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
      });
    };
    document.addEventListener('pointerdown', closeDropdownsOutside);
    document.addEventListener('focusin', closeDropdownsOutside);
  }
}

function setChecklistEditorItems(form, items) {
  const root = form?.querySelector('[data-checklist-editor-items]');
  if (!root) return;
  const checklist = normalizeChecklist(items);
  const rows = checklist.length ? checklist : [{ text: '', checked: false }];
  root.innerHTML = rows.map((item) => checklistEditorRowMarkup(item)).join('');
}

function checklistEditorRowMarkup(item = { text: '' }) {
  return `
    <div class="checklist-editor-row">
      <span class="checklist-editor-box" aria-hidden="true"></span>
      <input class="checklist-editor-input" type="text" value="${escapeHtml(item.text)}" placeholder="Checklist item" aria-label="Checklist item" />
      <button type="button" class="icon-btn" data-remove-checklist-item aria-label="Remove checklist item">Remove</button>
    </div>`;
}

function getChecklistEditorItems(form, existingChecklist = []) {
  const text = [...form.querySelectorAll('.checklist-editor-input')]
    .map((input) => input.value.trim())
    .filter(Boolean)
    .join('\n');
  return checklistFromText(text, existingChecklist);
}

function addChecklistEditorItem(form) {
  const root = form?.querySelector('[data-checklist-editor-items]');
  if (!root) return;
  root.insertAdjacentHTML('beforeend', checklistEditorRowMarkup());
  root.lastElementChild?.querySelector('.checklist-editor-input')?.focus();
}

function setChecklistEditorImage(form, imageUrl) {
  const hiddenInput = form?.elements?.checklistImage;
  const preview = form?.querySelector('[data-checklist-image-preview]');
  const image = form?.querySelector('[data-checklist-image-preview-image]');
  if (!hiddenInput || !preview || !image) return;
  hiddenInput.value = imageUrl || '';
  preview.hidden = !imageUrl;
  if (imageUrl) image.src = imageUrl;
  else image.removeAttribute('src');
}

function resizeChecklistImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not load the image.'));
      image.onload = () => {
        const scale = Math.min(1, 720 / image.width, 720 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function toggleChecklistItem(taskId, itemIndex, checked) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const previousChecklist = normalizeChecklist(task.checklist);
  const checklist = normalizeChecklist(task.checklist);
  if (!checklist[itemIndex]) return;
  checklist[itemIndex].checked = checked;
  task.checklist = checklist;

  const payload = buildTaskPayload(state.tasks, new Date());
  state.tasks = payload.tasks;
  state.available = payload.available;
  state.completed = payload.completed;
  saveLocalTasks(state.tasks);
  renderAll();
  document.querySelectorAll('.task-swipe-shell').forEach((shell) => {
    if (shell.dataset.taskId === taskId) shell.querySelector('.task-checklist')?.setAttribute('open', '');
  });

  try {
    await api(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(task) });
  } catch (error) {
    console.error('Failed to update checklist item', error);
    task.checklist = previousChecklist;
    await loadTaskData();
  }
}

function timeTagOptions(category = '') {
  if (category === 'opening') {
    return [
      '<option value="">Not assigned</option>',
      ...openingStages.map((stage) => `<option value="${stage}">${openingStageLabels[stage]}</option>`)
    ].join('');
  }
  const options = ['<option value="">Any time</option>'];
  const startMinutes = category === 'closing' ? 14 * 60 : 0;
  const endMinutes = category === 'closing' ? 17 * 60 : (24 * 60) - 10;
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 10) {
    const hours24 = Math.floor(minutes / 60);
    const minute = String(minutes % 60).padStart(2, '0');
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    const value = `${hours12}:${minute}${suffix}+`;
    options.push(`<option value="${value}">${value}</option>`);
  }
  return options.join('');
}

function updateTimeTagOptions(form) {
  const select = form?.elements?.timeTag;
  if (!select) return;
  const selectedValue = select.value;
  const category = form.elements.category?.value || '';
  select.innerHTML = timeTagOptions(category);
  const timeTagLabel = form.querySelector('[data-time-tag-label]');
  if (timeTagLabel) timeTagLabel.textContent = category === 'opening' ? 'Opening order' : 'Time tag';
  if ([...select.options].some((option) => option.value === selectedValue)) {
    select.value = selectedValue;
  }
}

function initializeTimeTagSelects() {
  document.querySelectorAll('select[name="timeTag"]').forEach((select) => {
    const form = select.closest('form');
    if (!select.options.length) select.innerHTML = timeTagOptions(form?.elements.category?.value);
  });
}

function updateSeasonSwitcher(switcher = document.querySelector('.season-switcher')) {
  if (!switcher) return;
  switcher.classList.toggle('is-summer', state.season === 'summer');
  switcher.setAttribute('aria-pressed', String(state.season === 'summer'));
  switcher.setAttribute('aria-label', `Switch displayed season. Currently showing ${seasonLabels[state.season]}.`);
}

function ensureAppChrome() {
  const topbar = document.querySelector('.topbar');
  if (topbar && !topbar.querySelector('.season-switcher')) {
    const brand = topbar.querySelector('.brand-wrap');
    const start = document.createElement('div');
    start.className = 'topbar-start';
    const switcher = document.createElement('button');
    switcher.type = 'button';
    switcher.className = `season-switcher ${state.season === 'summer' ? 'is-summer' : ''}`;
    switcher.setAttribute('aria-label', `Switch displayed season. Currently showing ${seasonLabels[state.season]}.`);
    switcher.setAttribute('aria-pressed', String(state.season === 'summer'));
    switcher.innerHTML = '<span class="season-option">Winter</span><span class="season-option">Summer</span>';
    topbar.insertBefore(start, brand);
    start.append(switcher, brand);
    switcher.addEventListener('click', () => {
      const nextSeason = state.season === 'winter' ? 'summer' : 'winter';
      if (!window.confirm(`Are you sure you want to switch from ${seasonLabels[state.season]} to ${seasonLabels[nextSeason]}?`)) return;
      switcher.disabled = true;
      state.season = nextSeason;
      updateSeasonSwitcher(switcher);
      saveSeasonSelection(nextSeason);
      window.setTimeout(() => {
        const payload = buildTaskPayload(state.tasks, new Date());
        state.tasks = payload.tasks;
        state.available = payload.available;
        state.completed = payload.completed;
        renderAll();
        switcher.disabled = false;
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
    });
  }
  if (topbar && !topbar.querySelector('[data-open-task-modal]')) {
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-item-field';
    addButton.dataset.openTaskModal = '';
    addButton.innerHTML = '<span>＋</span> Add item';
    topbar.insertBefore(addButton, topbar.querySelector('.nav'));
  }
  if (!document.getElementById('taskForm')) document.body.insertAdjacentHTML('beforeend', taskFormMarkup());
  if (!document.getElementById('completedModal')) {
    document.body.insertAdjacentHTML('beforeend', '<div id="completedModal" class="modal hidden" aria-hidden="true"><div class="modal-backdrop" data-close-completed></div><div class="modal-card"><div class="modal-header"><h2>Completed Tasks</h2><button type="button" class="icon-btn" data-close-completed>Close</button></div><ul id="completedList" class="mini-list modal-list"></ul></div></div>');
  }
  const completedModal = document.getElementById('completedModal');
  if (completedModal && !completedModal.querySelector('[data-completed-search]')) {
    completedModal.querySelector('.modal-header')?.insertAdjacentHTML('afterend', '<div class="quick-day-combobox task-search-combobox completed-search"><input type="search" data-completed-search placeholder="Search completed tasks…" aria-label="Search completed tasks" aria-autocomplete="list" autocomplete="off" /><div class="quick-day-suggestions" data-completed-suggestions role="listbox" hidden></div></div>');
  }
  if (!document.getElementById('closingCompleteModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="closingCompleteModal" class="modal hidden" aria-hidden="true">
        <div class="modal-backdrop" data-close-closing-complete></div>
        <div class="modal-card closing-complete-card" role="dialog" aria-modal="true" aria-labelledby="closingCompleteTitle">
          <div class="closing-complete-icon" aria-hidden="true">✓</div>
          <h2 id="closingCompleteTitle" data-closing-encouragement>${encouragementMessages[0]}</h2>
          <p>Check that no food is left in the fridge!</p>
          <p>If you’re the last one out, make sure to:</p>
          <ul>
            <li>Turn lights off</li>
            <li>Set alarm</li>
            <li>Lock front door</li>
          </ul>
          <button type="button" class="primary-btn" data-close-closing-complete>Got it</button>
        </div>
      </div>
    `);
  }
  if (!document.getElementById('taskMilestoneModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="taskMilestoneModal" class="modal hidden" aria-hidden="true">
        <div class="modal-backdrop" data-close-task-milestone></div>
        <div class="modal-card celebration-card" role="dialog" aria-modal="true" aria-labelledby="taskMilestoneTitle">
          <div class="celebration-icon" aria-hidden="true">★</div>
          <p class="celebration-kicker">Five tasks complete</p>
          <h2 id="taskMilestoneTitle" data-milestone-encouragement>${encouragementMessages[1]}</h2>
          <p data-milestone-encouragement-detail>${encouragementMessages[2]}</p>
          <button type="button" class="primary-btn" data-close-task-milestone>Got it</button>
        </div>
      </div>
    `);
  }
}

function updateStickyHeaderOffset() {
  const topbar = document.querySelector('.topbar');
  if (topbar) document.documentElement.style.setProperty('--topbar-height', `${topbar.offsetHeight}px`);
}

function scheduleMidnightRollover() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  setTimeout(async () => {
    state.season = getSavedSeason();
    updateSeasonSwitcher();
    state.dayLists = null;
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
    form.elements.season.value = normalizeSeason(task.season);
    setUrgentDays(form, task.urgentOn || []);
    form.elements.timeTag.value = task.timeTag || '';
    setChecklistEditorItems(form, normalizeChecklist(task.checklist).length
      ? task.checklist
      : checklistFromText(task.description));
    setChecklistEditorImage(form, task.checklistImage || '');
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

function openClosingCompleteModal() {
  const modal = document.getElementById('closingCompleteModal');
  if (!modal) return;
  const title = modal.querySelector('[data-closing-encouragement]');
  if (title) title.textContent = getEncouragementMessage(`closing-${Date.now()}`);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  launchConfetti();
  modal.querySelector('[data-close-closing-complete]')?.focus();
}

function closeClosingCompleteModal() {
  const modal = document.getElementById('closingCompleteModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function todayStorageKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function recordMilestoneTask(taskId) {
  try {
    const saved = JSON.parse(localStorage.getItem(CELEBRATION_PROGRESS_KEY) || 'null');
    const progress = saved?.date === todayStorageKey()
      ? saved
      : { date: todayStorageKey(), taskIds: [], celebrated: false };
    progress.taskIds = [...new Set([...(progress.taskIds || []), taskId])];
    if (progress.taskIds.length >= 5 && !progress.celebrated) {
      progress.celebrated = true;
      openTaskMilestoneModal();
    }
    localStorage.setItem(CELEBRATION_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Could not save celebration progress', error);
  }
}

function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.confetti-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  const colors = ['#376438', '#c68b70', '#edc94d', '#5277a6', '#845796', '#f7eee7'];
  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement('i');
    piece.style.setProperty('--confetti-x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--confetti-drift', `${(Math.random() - 0.5) * 22}vw`);
    piece.style.setProperty('--confetti-delay', `${Math.random() * 0.55}s`);
    piece.style.setProperty('--confetti-duration', `${1.8 + Math.random() * 1.6}s`);
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--confetti-rotation', `${360 + Math.random() * 720}deg`);
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3900);
}

function openTaskMilestoneModal() {
  const modal = document.getElementById('taskMilestoneModal');
  if (!modal) return;
  const messageSeed = Date.now();
  const title = modal.querySelector('[data-milestone-encouragement]');
  const detail = modal.querySelector('[data-milestone-encouragement-detail]');
  if (title) title.textContent = getEncouragementMessage(`milestone-title-${messageSeed}`);
  if (detail) detail.textContent = getEncouragementMessage(`milestone-detail-${messageSeed}`);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  launchConfetti();
  modal.querySelector('[data-close-task-milestone]')?.focus();
}

function closeTaskMilestoneModal() {
  const modal = document.getElementById('taskMilestoneModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

window.addEventListener('DOMContentLoaded', async () => {
  ensureAppChrome();
  initializeTaskCardDetails();
  initializeNavIndicator();
  updateStickyHeaderOffset();
  window.addEventListener('resize', updateStickyHeaderOffset);
  window.addEventListener('online', () => saveDayListsState(getDayListsState()));
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    state.season = getSavedSeason();
    updateSeasonSwitcher();
    state.dayLists = null;
    loadTaskData();
  });
  window.addEventListener('storage', (event) => {
    if (![STORAGE_KEY, DAY_LISTS_KEY, SEASON_KEY, SEASON_OVERRIDE_DATE_KEY].includes(event.key)) return;
    if ([SEASON_KEY, SEASON_OVERRIDE_DATE_KEY].includes(event.key)) {
      state.season = getSavedSeason();
      updateSeasonSwitcher();
    }
    state.dayLists = null;
    loadTaskData();
  });
  prefetchAppPages();
  initializeTimeTagSelects();
  initializeUrgentDayDropdowns();
  const form = document.getElementById('taskForm');
  if (form) {
    form.addEventListener('submit', handleTaskSubmit);
    document.getElementById('resetForm').addEventListener('click', resetForm);
    const categorySelect = form.elements.category;
    categorySelect.addEventListener('change', updatePeriodVisibility);
    updatePeriodVisibility();
    setChecklistEditorItems(form, []);
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-checklist-item]');
    if (addButton) addChecklistEditorItem(addButton.closest('form'));
    const removeButton = event.target.closest('[data-remove-checklist-item]');
    if (removeButton) {
      const form = removeButton.closest('form');
      const row = removeButton.closest('.checklist-editor-row');
      row?.remove();
      if (!form.querySelector('.checklist-editor-row')) setChecklistEditorItems(form, []);
    }
    const removeImageButton = event.target.closest('[data-remove-checklist-image]');
    if (removeImageButton) setChecklistEditorImage(removeImageButton.closest('form'), '');
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-checklist-task-id]');
    if (input) toggleChecklistItem(input.dataset.checklistTaskId, Number(input.dataset.checklistIndex), input.checked);
    const imageInput = event.target.closest('[data-checklist-image-input]');
    if (imageInput?.files?.[0]) {
      resizeChecklistImage(imageInput.files[0])
        .then((imageUrl) => setChecklistEditorImage(imageInput.closest('form'), imageUrl))
        .catch((error) => alert(error.message));
    }
  });

  document.querySelectorAll('[data-close-completed]').forEach((button) => {
    button.addEventListener('click', closeCompletedModal);
  });
  document.querySelectorAll('[data-open-task-modal]').forEach((button) => button.addEventListener('click', () => { resetForm(); openTaskModal(); }));
  document.querySelectorAll('[data-close-task-modal]').forEach((button) => button.addEventListener('click', closeTaskModal));
  document.querySelectorAll('[data-close-closing-complete]').forEach((button) => button.addEventListener('click', closeClosingCompleteModal));
  document.querySelectorAll('[data-close-task-milestone]').forEach((button) => button.addEventListener('click', closeTaskMilestoneModal));
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
      closeTaskModal();
      closeClosingCompleteModal();
      closeTaskMilestoneModal();
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
