const TUTORIAL_DB_NAME = 'cafe-palmier-tutorials';
const TUTORIAL_STORE_NAME = 'videos';
const TUTORIAL_BUCKET = 'cafe-tutorial-videos';
const supabaseConfig = window.SUPABASE_CONFIG;

function openLocalTutorialDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TUTORIAL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TUTORIAL_STORE_NAME)) database.createObjectStore(TUTORIAL_STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localTutorialStore(mode, operation) {
  const database = await openLocalTutorialDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TUTORIAL_STORE_NAME, mode);
    const request = operation(transaction.objectStore(TUTORIAL_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

function supabaseHeaders(extra = {}) {
  return { apikey: supabaseConfig.publishableKey, Authorization: `Bearer ${supabaseConfig.publishableKey}`, ...extra };
}

async function sharedRequest(path, options = {}) {
  if (!supabaseConfig?.url || !supabaseConfig?.publishableKey) throw new Error('Shared tutorial storage is not configured.');
  const response = await fetch(`${supabaseConfig.url}${path}`, { ...options, headers: supabaseHeaders(options.headers) });
  const responseText = await response.text();
  if (!response.ok) throw new Error(responseText || `Request failed with ${response.status}`);
  return responseText ? JSON.parse(responseText) : null;
}

function encodedStoragePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function publicVideoUrl(path) {
  return `${supabaseConfig.url}/storage/v1/object/public/${TUTORIAL_BUCKET}/${encodedStoragePath(path)}`;
}

function videoExtension(video) {
  const nameExtension = video.name?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (nameExtension && nameExtension.length <= 5) return nameExtension;
  return ({ 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v', 'video/ogg': 'ogv' })[video.type] || 'mp4';
}

async function saveSharedTutorial({ id, title, video }) {
  if (!video.type.startsWith('video/')) throw new Error('Please select a video file.');
  const storagePath = `${id}/tutorial.${videoExtension(video)}`;
  await sharedRequest(`/storage/v1/object/${TUTORIAL_BUCKET}/${encodedStoragePath(storagePath)}`, {
    method: 'POST',
    headers: { 'Content-Type': video.type || 'application/octet-stream', 'x-upsert': 'true', 'Cache-Control': '3600' },
    body: video
  });
  try {
    const [tutorial] = await sharedRequest('/rest/v1/cafe_tutorials?on_conflict=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id, title, storage_path: storagePath })
    });
    return tutorial;
  } catch (error) {
    await deleteStoredVideo(storagePath).catch(() => {});
    throw error;
  }
}

function listSharedTutorials() {
  return sharedRequest('/rest/v1/cafe_tutorials?select=*&order=created_at.desc');
}

function deleteStoredVideo(storagePath) {
  return sharedRequest(`/storage/v1/object/${TUTORIAL_BUCKET}/${encodedStoragePath(storagePath)}`, { method: 'DELETE' });
}

async function deleteSharedTutorial(tutorial) {
  await sharedRequest(`/rest/v1/cafe_tutorials?id=eq.${encodeURIComponent(tutorial.id)}`, { method: 'DELETE' });
  await deleteStoredVideo(tutorial.storage_path).catch((error) => console.warn('Tutorial metadata was deleted, but its video could not be removed.', error));
}

function escapeTutorialText(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function migrateDeviceTutorials() {
  const localTutorials = await localTutorialStore('readonly', (store) => store.getAll());
  for (const tutorial of localTutorials) {
    await saveSharedTutorial({ id: tutorial.id, title: tutorial.title, video: tutorial.video });
    await localTutorialStore('readwrite', (store) => store.delete(tutorial.id));
  }
}

async function renderTutorials() {
  const grid = document.getElementById('tutorialGrid');
  try {
    const tutorials = await listSharedTutorials();
    if (!tutorials.length) {
      grid.innerHTML = '<div class="tutorial-empty"><span aria-hidden="true">▶</span><h2>No tutorials yet</h2><p>Add your first video guide to get started.</p></div>';
      return;
    }
    grid.innerHTML = tutorials.map((tutorial) => `<article class="tutorial-card">
      <div class="tutorial-video-wrap"><video src="${publicVideoUrl(tutorial.storage_path)}" controls preload="metadata" playsinline aria-label="${escapeTutorialText(tutorial.title)}"></video></div>
      <div class="tutorial-card-copy"><h2>${escapeTutorialText(tutorial.title)}</h2><button class="icon-btn tutorial-delete" type="button" data-delete-tutorial="${escapeTutorialText(tutorial.id)}" aria-label="Delete ${escapeTutorialText(tutorial.title)}">Delete</button></div>
    </article>`).join('');
    grid.querySelectorAll('[data-delete-tutorial]').forEach((button) => button.addEventListener('click', async () => {
      const tutorial = tutorials.find((item) => item.id === button.dataset.deleteTutorial);
      if (!tutorial || !window.confirm('Delete this tutorial for everyone?')) return;
      button.disabled = true;
      try {
        await deleteSharedTutorial(tutorial);
        await renderTutorials();
      } catch (error) {
        button.disabled = false;
        window.alert('This tutorial could not be deleted. Please try again.');
      }
    }));
  } catch (error) {
    console.error('Could not load shared tutorials', error);
    grid.innerHTML = '<div class="tutorial-empty"><h2>Shared tutorials need to be connected</h2><p>Run the latest Supabase setup, then refresh this page.</p></div>';
  }
}

function setTutorialModal(open) {
  const modal = document.getElementById('tutorialModal');
  modal.classList.toggle('hidden', !open);
  modal.setAttribute('aria-hidden', String(!open));
  if (open) window.setTimeout(() => document.getElementById('tutorialForm').elements.title.focus(), 0);
}

document.addEventListener('DOMContentLoaded', async () => {
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
    status.textContent = 'Uploading video for everyone…';
    try {
      await saveSharedTutorial({ id: `tutorial-${crypto.randomUUID()}`, title, video });
      form.reset();
      status.textContent = '';
      setTutorialModal(false);
      await renderTutorials();
    } catch (error) {
      console.error('Could not upload tutorial', error);
      status.textContent = 'This video could not be uploaded. Check the shared Supabase setup, file size, and connection.';
    } finally {
      submit.disabled = false;
    }
  });

  try {
    await migrateDeviceTutorials();
  } catch (error) {
    console.warn('Existing device tutorials will be migrated after shared storage is configured.', error);
  }
  await renderTutorials();
});
