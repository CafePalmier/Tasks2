const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

const PERIOD_ORDER = { daily: 0, weekly: 1, monthly: 2, yearly: 3 };
const CATEGORY_ORDER = {
  cleaning: 0,
  stocking: 1,
  prep: 2,
  closing: 3,
  general: 4
};

const DEFAULT_TASKS = [
  { id: 'task-1', title: 'Windex doors and fridges', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 1 },
  { id: 'task-2', title: 'Clean outside tables', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 2 },
  { id: 'task-3', title: 'Wipe fridges', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 3 },
  { id: 'task-4', title: 'Check teas & fill tea bags if needed', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 4 },
  { id: 'task-5', title: 'Stamp cups/pastry bags if needed', category: 'prep', period: 'daily', description: '', urgentOn: [], isActive: true, order: 5 },
  { id: 'task-6', title: 'Stock/face display freezer', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 6 },
  { id: 'task-7', title: 'Stock/face retail shelves', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 7 },
  { id: 'task-8', title: 'Stock/face coffee shelves', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 8 },
  { id: 'task-9', title: 'Pull pastry for next day', category: 'prep', period: 'daily', description: '', urgentOn: [], isActive: true, order: 9 },
  { id: 'task-10', title: 'Clean bathroom AM', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 10 },
  { id: 'task-11', title: 'Clean bathroom MID', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 11 },
  { id: 'task-12', title: 'Clean bathrooms PM', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 12 },
  { id: 'task-13', title: 'Refill brown napkins', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 13 },
  { id: 'task-14', title: 'Refill takeout station', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 14 },
  { id: 'task-15', title: 'Stock/face beer fridge', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 15 },
  { id: 'task-16', title: 'Stock/face drink fridge', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 16 },
  { id: 'task-17', title: 'Make sure we have 3 ice backup bags in freezer', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 17 },
  { id: 'task-18', title: 'Fill ice bags', category: 'stocking', period: 'daily', description: 'Weekday task to keep the ice station stocked.', urgentOn: ['Friday'], isActive: true, order: 18 },
  { id: 'task-19', title: 'Make sure no garbage anywhere, parking lot etc.', category: 'cleaning', period: 'daily', description: '', urgentOn: [], isActive: true, order: 19 },
  { id: 'task-20', title: 'Roll-ups', category: 'stocking', period: 'daily', description: '', urgentOn: [], isActive: true, order: 20 },
  { id: 'task-21', title: 'Prep coffee for weekend', category: 'prep', period: 'daily', description: 'Get the weekend setup prepared well before the rush.', urgentOn: ['Friday'], isActive: true, order: 21 },
  { id: 'task-22', title: 'Fill sanitizer bottles', category: 'stocking', period: 'daily', description: 'Top up sanitizer bottles around the shop.', urgentOn: ['Friday'], isActive: true, order: 22 },

  { id: 'task-23', title: 'Deep clean coffee urns', category: 'cleaning', period: 'weekly', description: '', urgentOn: [], isActive: true, order: 23 },
  { id: 'task-24', title: 'Check and restock endcaps', category: 'stocking', period: 'weekly', description: '', urgentOn: [], isActive: true, order: 24 },
  { id: 'task-25', title: 'Rotate pastry display', category: 'prep', period: 'weekly', description: '', urgentOn: [], isActive: true, order: 25 },
  { id: 'task-26', title: 'Review to-go packaging station', category: 'stocking', period: 'weekly', description: '', urgentOn: [], isActive: true, order: 26 },

  { id: 'task-27', title: 'Deep clean display fridges', category: 'cleaning', period: 'monthly', description: '', urgentOn: [], isActive: true, order: 27 },
  { id: 'task-28', title: 'Audit syrups and milk stock', category: 'stocking', period: 'monthly', description: '', urgentOn: [], isActive: true, order: 28 },
  { id: 'task-29', title: 'Check backroom inventory levels', category: 'stocking', period: 'monthly', description: '', urgentOn: [], isActive: true, order: 29 },
  { id: 'task-30', title: 'Review prep notes and restock seasonal items', category: 'prep', period: 'monthly', description: '', urgentOn: [], isActive: true, order: 30 },

  { id: 'task-31', title: 'Seasonal décor refresh', category: 'general', period: 'yearly', description: '', urgentOn: [], isActive: true, order: 31 },
  { id: 'task-32', title: 'Annual equipment inspection', category: 'general', period: 'yearly', description: '', urgentOn: [], isActive: true, order: 32 },
  { id: 'task-33', title: 'Review staffing plan and staff training checklist', category: 'general', period: 'yearly', description: '', urgentOn: [], isActive: true, order: 33 },

  { id: 'task-34', title: 'Lock shed', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 34 },
  { id: 'task-35', title: 'Close umbrellas', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 35 },
  { id: 'task-36', title: 'Change garbages and bring in bins if raining', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 36 },
  { id: 'task-37', title: 'Let people know we\'re closing', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 37 },
  { id: 'task-38', title: 'Clear walkway (rocks, sticks, etc.)', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 38 },
  { id: 'task-39', title: 'Pick up litter', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 39 },
  { id: 'task-40', title: 'Clean bathroom', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 40 },
  { id: 'task-41', title: 'Lock door', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 41 },
  { id: 'task-42', title: 'Sweep walkway', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 42 },
  { id: 'task-43', title: 'Shut display fridge light off', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 43 },
  { id: 'task-44', title: 'Shut lights off, set alarm, and lock up', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 44 },
  { id: 'task-45', title: 'Face/stock fridges and coffee shelves', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 45 },
  { id: 'task-46', title: 'Pull pastries', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 46 },
  { id: 'task-47', title: 'Fill sanitizer bottles', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 47 },
  { id: 'task-48', title: 'Stock to-go boxes', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 48 },
  { id: 'task-49', title: 'Replace green trays on trolley', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 49 },
  { id: 'task-50', title: 'Dump 3 litres of water down milk drain', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 50 },
  { id: 'task-51', title: 'Plug in scales', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 51 },
  { id: 'task-52', title: 'Check you did everything on the closing list', category: 'closing', period: 'daily', description: '', urgentOn: [], isActive: true, order: 52 }
];

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: DEFAULT_TASKS }, null, 2), 'utf8');
  }
}

function loadTasks() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw || '{"tasks":[]}');
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

  return tasks.map((task, idx) => normalizeTask(task, idx));
}

function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks }, null, 2), 'utf8');
}

function normalizeTask(task, idx) {
  return {
    id: task.id || `task-${Date.now()}-${idx}`,
    title: String(task.title || 'Untitled task').trim(),
    category: task.category || 'general',
    period: task.period || 'daily',
    description: task.description || '',
    urgentOn: Array.isArray(task.urgentOn) ? task.urgentOn.map((day) => String(day).trim()) : [],
    isActive: task.isActive !== false,
    lastCompletedAt: task.lastCompletedAt || null,
    area: task.area || 'General',
    order: task.order ?? idx + 1
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function timeStampForDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
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
      return { start: startOfWeek(date), end: new Date(startOfWeek(date).getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 999) };
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
    const byPeriod = (PERIOD_ORDER[a.period] ?? 99) - (PERIOD_ORDER[b.period] ?? 99);
    if (byPeriod !== 0) return byPeriod;

    const byCategory = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
    if (byCategory !== 0) return byCategory;

    return (a.order ?? 999) - (b.order ?? 999);
  });

  for (const task of sortedTasks) {
    if (!task.isActive) continue;

    const completedInCurrentCycle = isCompletedInCurrentCycle(task, now);
    const resultTask = {
      ...task,
      urgentToday: isUrgentTask(task, now)
    };

    if (completedInCurrentCycle) {
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

function getFileFromPath(requestPath) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  return path.join(PUBLIC_DIR, safePath);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = parsedUrl;

  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/tasks' && req.method === 'GET') {
        const tasks = loadTasks();
        const payload = buildTaskPayload(tasks, new Date());
        return sendJson(res, 200, payload);
      }

      if (pathname === '/api/tasks' && req.method === 'POST') {
        const body = await readBody(req);
        const tasks = loadTasks();
        const newTask = normalizeTask({
          ...body,
          id: body.id || `task-${Date.now()}-${tasks.length + 1}`,
          title: body.title || 'Untitled task',
          order: tasks.length + 1,
          isActive: body.isActive !== false
        }, tasks.length);

        tasks.push(newTask);
        saveTasks(tasks);
        return sendJson(res, 201, { task: newTask });
      }

      if (pathname.startsWith('/api/tasks/') && req.method === 'PUT') {
        const id = pathname.split('/')[3];
        const body = await readBody(req);
        const tasks = loadTasks();
        const taskIndex = tasks.findIndex((task) => task.id === id);

        if (taskIndex === -1) {
          return sendJson(res, 404, { error: 'Task not found' });
        }

        tasks[taskIndex] = normalizeTask({
          ...tasks[taskIndex],
          ...body,
          urgentOn: Array.isArray(body.urgentOn) ? body.urgentOn : (tasks[taskIndex].urgentOn || [])
        }, taskIndex);

        saveTasks(tasks);
        return sendJson(res, 200, { task: tasks[taskIndex] });
      }

      if (pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
        const id = pathname.split('/')[3];
        const tasks = loadTasks();
        const nextTasks = tasks.filter((task) => task.id !== id);
        saveTasks(nextTasks);
        return sendJson(res, 200, { deleted: true });
      }

      if (pathname.startsWith('/api/tasks/') && req.method === 'POST') {
        const segments = pathname.split('/').filter(Boolean);
        const id = segments[2];
        const action = segments[3];
        const tasks = loadTasks();
        const taskIndex = tasks.findIndex((task) => task.id === id);

        if (taskIndex === -1) {
          return sendJson(res, 404, { error: 'Task not found' });
        }

        if (action === 'complete') {
          tasks[taskIndex].lastCompletedAt = new Date().toISOString();
          saveTasks(tasks);
          return sendJson(res, 200, { task: tasks[taskIndex] });
        }

        if (action === 'reopen') {
          tasks[taskIndex].lastCompletedAt = null;
          saveTasks(tasks);
          return sendJson(res, 200, { task: tasks[taskIndex] });
        }
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      console.error(error);
      return sendJson(res, 500, { error: 'Server error' });
    }
  }

  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = getFileFromPath(requestPath);

  if (filePath.startsWith(PUBLIC_DIR)) {
    serveFile(res, filePath);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cafe Palmier task site is running on http://localhost:${PORT}`);
});
