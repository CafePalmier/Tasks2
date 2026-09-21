const TUTORIAL_DB_NAME = 'cafe-palmier-tutorials';
const TUTORIAL_STORE_NAME = 'videos';
let tutorialObjectUrls = [];

function openTutorialDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TUTORIAL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TUTORIAL_STORE_NAME)) {
        database.createObjectStore(TUTORIAL_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tutorialStore(mode, operation) {
  const database = await openTutorialDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TUTORIAL_STORE_NAME, mode);
    const request = operation(transaction.objectStore(TUTORIAL_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

function escapeTutorialText(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function renderTutorials() {
  const grid = document.getElementById('tutorialGrid');
  tutorialObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  tutorialObjectUrls = [];
  try {
    const tutorials = await tutorialStore('readonly', (store) => store.getAll());
    tutorials.sort((a, b) => b.createdAt - a.createdAt);
    if (!tutorials.length) {
      grid.innerHTML = '<div class="tutorial-empty"><span aria-hidden="true">▶</span><h2>No tutorials yet</h2><p>Add your first video guide to get started.</p></div>';
      return;
    }
    grid.innerHTML = tutorials.map((tutorial) => {
      const url = URL.createObjectURL(tutorial.video);
      tutorialObjectUrls.push(url);
      return `<article class="tutorial-card">
        <div class="tutorial-video-wrap"><video src="${url}" controls preload="metadata" aria-label="${escapeTutorialText(tutorial.title)}"></video></div>
        <div class="tutorial-card-copy"><h2>${escapeTutorialText(tutorial.title)}</h2><button class="icon-btn tutorial-delete" type="button" data-delete-tutorial="${tutorial.id}" aria-label="Delete ${escapeTutorialText(tutorial.title)}">Delete</button></div>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-delete-tutorial]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Delete this tutorial?')) return;
      await tutorialStore('readwrite', (store) => store.delete(button.dataset.deleteTutorial));
      renderTutorials();
    }));
  } catch (error) {
    grid.innerHTML = '<div class="tutorial-empty"><h2>Could not load tutorials</h2><p>Please refresh and try again.</p></div>';
  }
}

function setTutorialModal(open) {
  const modal = document.getElementById('tutorialModal');
  modal.classList.toggle('hidden', !open);
  modal.setAttribute('aria-hidden', String(!open));
  if (open) window.setTimeout(() => document.getElementById('tutorialForm').elements.title.focus(), 0);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('tutorialForm');
  document.querySelector('[data-open-tutorial-modal]').addEventListener('click', () => setTutorialModal(true));
  document.querySelectorAll('[data-close-tutorial-modal]').forEach((button) => button.addEventListener('click', () => setTutorialModal(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setTutorialModal(false); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-tutorial-status]');
    const submit = form.querySelector('[type="submit"]');
    const title = form.elements.title.value.trim();
    const video = form.elements.video.files[0];
    if (!title || !video) return;
    submit.disabled = true;
    status.textContent = 'Saving video…';
    try {
      await tutorialStore('readwrite', (store) => store.put({ id: `tutorial-${Date.now()}`, title, video, createdAt: Date.now() }));
      form.reset();
      status.textContent = '';
      setTutorialModal(false);
      await renderTutorials();
    } catch (error) {
      status.textContent = 'This video could not be saved. Try a smaller file or free up browser storage.';
    } finally {
      submit.disabled = false;
    }
  });
  renderTutorials();
});

window.addEventListener('beforeunload', () => tutorialObjectUrls.forEach((url) => URL.revokeObjectURL(url)));
