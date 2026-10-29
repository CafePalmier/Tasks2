const TUTORIAL_DB_NAME = 'cafe-palmier-tutorials';
const TUTORIAL_STORE_NAME = 'videos';
const TUTORIAL_BUCKET = 'cafe-tutorial-videos';
const SHARED_REFRESH_INTERVAL_MS = 30_000;
const DEFAULT_TUTORIAL_TAGS = ['Technology', 'Closing', 'Opening', 'Cleaning & Prep', 'Equipment'];
const supabaseConfig = window.SUPABASE_CONFIG;
const tutorialState = { items: [], search: '', selectedTag: '', slideIndices: new Map() };
const tutorialDetailState = { tutorialId: '', slideIndex: 0 };
let tutorialRefreshPromise = null;

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

function publicMediaUrl(path) {
  return `${supabaseConfig.url}/storage/v1/object/public/${TUTORIAL_BUCKET}/${encodedStoragePath(path)}`;
}

function mediaTypeFor(value = '') {
  return String(value).toLowerCase().startsWith('video/') || String(value).toLowerCase() === 'video' ? 'video' : 'image';
}

function mediaExtension(file) {
  const nameExtension = file.name?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (nameExtension && nameExtension.length <= 5) return nameExtension;
  return ({
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v', 'video/ogg': 'ogv'
  })[file.type] || (file.type.startsWith('image/') ? 'jpg' : 'mp4');
}

function normalizeSlide(slide, index = 0) {
  const storagePath = String(slide?.storage_path || slide?.storagePath || '').trim();
  return {
    id: String(slide?.id || `slide-${index + 1}`),
    storage_path: storagePath,
    media_type: mediaTypeFor(slide?.media_type || slide?.mediaType || storagePath),
    title: String(slide?.title || '').trim(),
    description: String(slide?.description || '').trim(),
    order: Number.isFinite(Number(slide?.order)) ? Number(slide.order) : index
  };
}

function normalizeTutorial(tutorial) {
  let slides = Array.isArray(tutorial?.slides) ? tutorial.slides.map(normalizeSlide) : [];
  if (!slides.length && tutorial?.storage_path) slides = [normalizeSlide({ storage_path: tutorial.storage_path, media_type: 'video' }, 0)];
  return {
    ...tutorial,
    id: String(tutorial.id),
    title: String(tutorial.title || 'Untitled tutorial').trim(),
    tags: Array.isArray(tutorial.tags) ? tutorial.tags.flatMap((tag) => {
      const normalizedTag = String(tag).trim();
      return normalizedTag === 'Closing & Opening' ? ['Closing', 'Opening'] : [normalizedTag];
    }).filter(Boolean) : [],
    slides: slides.filter((slide) => slide.storage_path).sort((a, b) => a.order - b.order)
  };
}

function publicMediaType(fileOrSlide) {
  return mediaTypeFor(fileOrSlide?.type || fileOrSlide?.media_type || fileOrSlide?.storage_path);
}

async function uploadTutorialMedia(tutorialId, slideId, file) {
  if (!file?.type?.startsWith('image/') && !file?.type?.startsWith('video/')) throw new Error('Please use image or video files for tutorial slides.');
  const storagePath = `${tutorialId}/${slideId}-${crypto.randomUUID()}.${mediaExtension(file)}`;
  await sharedRequest(`/storage/v1/object/${TUTORIAL_BUCKET}/${encodedStoragePath(storagePath)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true', 'Cache-Control': '3600' },
    body: file
  });
  return { storage_path: storagePath, media_type: publicMediaType(file) };
}

async function saveSharedTutorial({ id, title, tags, slides, previousTutorial = null }) {
  if (!slides?.length) throw new Error('Add at least one photo or video slide.');
  const uploadedPaths = [];
  const savedSlides = [];
  try {
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      const slideId = String(slide.id || `slide-${index + 1}`);
      let media = { storage_path: slide.storage_path, media_type: slide.media_type };
      if (slide.file) {
        media = await uploadTutorialMedia(id, slideId, slide.file);
        uploadedPaths.push(media.storage_path);
      }
      if (!media.storage_path) throw new Error(`Slide ${index + 1} needs a photo or video.`);
      savedSlides.push({
        id: slideId,
        storage_path: media.storage_path,
        media_type: media.media_type || publicMediaType(slide),
        title: String(slide.title || '').trim(),
        description: String(slide.description || '').trim(),
        order: index
      });
    }
    const [tutorial] = await sharedRequest('/rest/v1/cafe_tutorials?on_conflict=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        id, title, tags: [...new Set(tags || [])], slides: savedSlides,
        storage_path: savedSlides[0].storage_path
      })
    });
    const oldPaths = (previousTutorial?.slides?.length ? previousTutorial.slides : [{ storage_path: previousTutorial?.storage_path }])
      .map((slide) => slide.storage_path).filter(Boolean);
    await Promise.all(oldPaths.filter((path) => !savedSlides.some((slide) => slide.storage_path === path)).map((path) => deleteStoredMedia(path).catch(() => {})));
    return normalizeTutorial(tutorial);
  } catch (error) {
    await Promise.all(uploadedPaths.map((path) => deleteStoredMedia(path).catch(() => {})));
    throw error;
  }
}

function listSharedTutorials() {
  return sharedRequest('/rest/v1/cafe_tutorials?select=*&order=created_at.desc').then((items) => items.map(normalizeTutorial));
}

function deleteStoredMedia(storagePath) {
  return sharedRequest(`/storage/v1/object/${TUTORIAL_BUCKET}/${encodedStoragePath(storagePath)}`, { method: 'DELETE' });
}

async function deleteSharedTutorial(tutorial) {
  await sharedRequest(`/rest/v1/cafe_tutorials?id=eq.${encodeURIComponent(tutorial.id)}`, { method: 'DELETE' });
  const paths = (tutorial.slides?.length ? tutorial.slides : [{ storage_path: tutorial.storage_path }]).map((slide) => slide.storage_path).filter(Boolean);
  await Promise.all(paths.map((path) => deleteStoredMedia(path).catch((error) => console.warn('Tutorial metadata was deleted, but media could not be removed.', error))));
}

function escapeTutorialText(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function prepareTutorialPreview(video) {
  if (!video) return;
  video.defaultMuted = true;
  video.muted = true;
  const wrapper = video.closest('.tutorial-media-stage');
  const revealThumbnail = () => wrapper?.classList.add('thumbnail-ready');
  const seekToThumbnail = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime > 0) return;
    try { video.currentTime = Math.min(0.1, video.duration / 2); } catch (error) { /* The first loaded frame is still fine. */ }
  };
  video.addEventListener('loadedmetadata', seekToThumbnail, { once: true });
  video.addEventListener('loadeddata', revealThumbnail, { once: true });
  video.addEventListener('seeked', revealThumbnail, { once: true });
  video.addEventListener('play', () => wrapper?.classList.add('is-playing'));
  video.addEventListener('pause', () => wrapper?.classList.remove('is-playing'));
  video.addEventListener('ended', () => wrapper?.classList.remove('is-playing'));
  if (video.readyState >= 1) seekToThumbnail();
  if (video.readyState >= 2) revealThumbnail();
}

async function migrateDeviceTutorials() {
  const localTutorials = await localTutorialStore('readonly', (store) => store.getAll());
  for (const tutorial of localTutorials) {
    await saveSharedTutorial({
      id: tutorial.id,
      title: tutorial.title,
      tags: [],
      slides: [{ id: 'slide-1', file: tutorial.video, title: '', description: '' }]
    });
    await localTutorialStore('readwrite', (store) => store.delete(tutorial.id));
  }
}

function matchingTutorials(query = tutorialState.search) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return tutorialState.items.filter((tutorial) => {
    if (tutorialState.selectedTag && !tutorial.tags.includes(tutorialState.selectedTag)) return false;
    if (!normalizedQuery) return true;
    const searchable = [tutorial.title, ...(tutorial.tags || []), ...(tutorial.slides || []).flatMap((slide) => [slide.title, slide.description])].join(' ');
    return searchable.toLocaleLowerCase().includes(normalizedQuery);
  });
}

function renderTutorialTagNav() {
  const nav = document.querySelector('[data-tutorial-tag-nav]');
  if (!nav) return;
  const tags = [...new Set([
    ...DEFAULT_TUTORIAL_TAGS,
    ...tutorialState.items.flatMap((tutorial) => tutorial.tags || [])
  ])];
  nav.innerHTML = [
    `<button class="tutorial-filter-tag${tutorialState.selectedTag ? '' : ' is-active'}" type="button" data-tutorial-filter="" aria-pressed="${String(!tutorialState.selectedTag)}">All</button>`,
    ...tags.map((tag) => `<button class="tutorial-filter-tag${tutorialState.selectedTag === tag ? ' is-active' : ''}" type="button" data-tutorial-filter="${escapeTutorialText(tag)}" aria-pressed="${String(tutorialState.selectedTag === tag)}">${escapeTutorialText(tag)}</button>`)
  ].join('');
  nav.querySelectorAll('[data-tutorial-filter]').forEach((button) => button.addEventListener('click', () => {
    tutorialState.selectedTag = button.dataset.tutorialFilter || '';
    renderTutorialTagNav();
    renderTutorialGrid();
    renderTutorialSuggestions();
  }));
}

function renderTutorialTags(tutorial) {
  return tutorial.tags?.length ? `<div class="tutorial-tags">${tutorial.tags.map((tag) => `<span class="tutorial-tag">${escapeTutorialText(tag)}</span>`).join('')}</div>` : '';
}

function renderSlideMedia(slide, tutorial) {
  const url = `${publicMediaUrl(slide.storage_path)}${slide.media_type === 'video' ? '#t=0.1' : ''}`;
  if (slide.media_type === 'video') return `<video src="${url}" controls preload="metadata" muted playsinline aria-label="${escapeTutorialText(slide.title || tutorial.title)}"></video>`;
  return `<img src="${url}" alt="${escapeTutorialText(slide.title || tutorial.title)}" loading="lazy" />`;
}

function renderTutorialCardSlide(card, tutorial, index) {
  const slides = tutorial.slides || [];
  const safeIndex = Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0));
  tutorialState.slideIndices.set(tutorial.id, safeIndex);
  const slide = slides[safeIndex];
  const stage = card.querySelector('[data-tutorial-stage]');
  if (!stage || !slide) return;
  stage.innerHTML = renderSlideMedia(slide, tutorial);
  stage.dataset.slideIndex = String(safeIndex);
  const video = stage.querySelector('video');
  if (video) prepareTutorialPreview(video);
  card.querySelectorAll('[data-tutorial-slide]').forEach((button) => {
    const isActive = Number(button.dataset.tutorialSlide) === safeIndex;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  const counter = card.querySelector('[data-tutorial-counter]');
  if (counter) counter.textContent = `${safeIndex + 1} / ${slides.length}`;
  const slideTitle = card.querySelector('[data-tutorial-slide-title]');
  const slideDescription = card.querySelector('[data-tutorial-slide-description]');
  if (slideTitle) { slideTitle.textContent = slide.title || `Step ${safeIndex + 1}`; slideTitle.hidden = !slide.title; }
  if (slideDescription) { slideDescription.textContent = slide.description; slideDescription.hidden = !slide.description; }
  const previousButton = card.querySelector('[data-tutorial-prev]');
  const nextButton = card.querySelector('[data-tutorial-next]');
  if (previousButton) previousButton.disabled = safeIndex === 0;
  if (nextButton) nextButton.disabled = safeIndex === slides.length - 1;
}

function renderTutorialDetailMedia(slide, tutorial) {
  const url = `${publicMediaUrl(slide.storage_path)}${slide.media_type === 'video' ? '#t=0.1' : ''}`;
  if (slide.media_type === 'video') return `<video src="${url}" controls preload="metadata" playsinline aria-label="${escapeTutorialText(slide.title || tutorial.title)}"></video>`;
  return `<img src="${url}" alt="${escapeTutorialText(slide.title || tutorial.title)}" />`;
}

function updateTutorialDetailControls(tutorial, index) {
  const previous = document.querySelector('[data-tutorial-detail-prev]');
  const next = document.querySelector('[data-tutorial-detail-next]');
  const counter = document.querySelector('[data-tutorial-detail-counter]');
  if (previous) previous.disabled = index === 0;
  if (next) {
    next.disabled = index >= tutorial.slides.length - 1;
    next.textContent = index >= tutorial.slides.length - 1 ? 'End of tutorial' : 'Next slide';
  }
  if (counter) counter.textContent = `${index + 1} of ${tutorial.slides.length}`;
  document.querySelectorAll('[data-tutorial-detail-dot]').forEach((dot) => {
    const isActive = Number(dot.dataset.tutorialDetailDot) === index;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-selected', String(isActive));
  });
}

function bindTutorialDetailScroll(track) {
  if (!track || track.dataset.scrollBound) return;
  track.addEventListener('scroll', () => {
    const tutorial = tutorialState.items.find((item) => item.id === tutorialDetailState.tutorialId);
    if (!tutorial || !track.clientWidth || !track.children.length) return;
    const nearestIndex = Math.min(
      Math.max(Math.round(track.scrollLeft / track.clientWidth), 0),
      tutorial.slides.length - 1
    );
    if (nearestIndex === tutorialDetailState.slideIndex) return;
    tutorialDetailState.slideIndex = nearestIndex;
    updateTutorialDetailControls(tutorial, nearestIndex);
  }, { passive: true });
  track.dataset.scrollBound = 'true';
}

function scrollTutorialDetailTo(index, behavior = 'smooth') {
  const tutorial = tutorialState.items.find((item) => item.id === tutorialDetailState.tutorialId);
  const track = document.querySelector('[data-tutorial-detail-track]');
  if (!tutorial || !track) return;
  const safeIndex = Math.min(Math.max(index, 0), Math.max(tutorial.slides.length - 1, 0));
  const target = track.children[safeIndex];
  if (!target) return;
  tutorialDetailState.slideIndex = safeIndex;
  updateTutorialDetailControls(tutorial, safeIndex);
  track.scrollTo({ left: target.offsetLeft, behavior });
}

function renderTutorialDetail() {
  const tutorial = tutorialState.items.find((item) => item.id === tutorialDetailState.tutorialId);
  const track = document.querySelector('[data-tutorial-detail-track]');
  if (!tutorial || !track) return;
  const slides = tutorial.slides || [];
  const index = Math.min(Math.max(tutorialDetailState.slideIndex, 0), Math.max(slides.length - 1, 0));
  tutorialDetailState.slideIndex = index;
  document.querySelector('[data-tutorial-detail-title]').textContent = tutorial.title;
  document.querySelector('[data-tutorial-detail-tags]').innerHTML = renderTutorialTags(tutorial);
  track.innerHTML = slides.map((slide, slideIndex) => `<article class="tutorial-detail-slide${slideIndex === index ? ' active' : ''}" data-tutorial-detail-slide="${slideIndex}"><div class="tutorial-detail-media">${renderTutorialDetailMedia(slide, tutorial)}</div><div class="tutorial-detail-copy"><span class="tutorial-detail-step">Step ${slideIndex + 1}</span><h3>${escapeTutorialText(slide.title || `Step ${slideIndex + 1}`)}</h3><p${slide.description ? '' : ' hidden'}>${escapeTutorialText(slide.description)}</p></div></article>`).join('');
  const dots = document.querySelector('[data-tutorial-detail-dots]');
  if (dots) {
    dots.innerHTML = slides.map((slide, slideIndex) => `<button class="tutorial-detail-dot${slideIndex === index ? ' is-active' : ''}" type="button" role="tab" data-tutorial-detail-dot="${slideIndex}" aria-label="Go to slide ${slideIndex + 1}" aria-selected="${slideIndex === index}"></button>`).join('');
    dots.querySelectorAll('[data-tutorial-detail-dot]').forEach((dot) => dot.addEventListener('click', () => {
      scrollTutorialDetailTo(Number(dot.dataset.tutorialDetailDot));
    }));
  }
  bindTutorialDetailScroll(track);
  updateTutorialDetailControls(tutorial, index);
  window.requestAnimationFrame(() => {
    const target = track.children[index];
    if (target) track.scrollLeft = target.offsetLeft;
  });
  track.querySelectorAll('video').forEach(prepareTutorialPreview);
}

function setTutorialDetailModal(open) {
  const modal = document.getElementById('tutorialDetailModal');
  if (!modal) return;
  modal.classList.toggle('hidden', !open);
  modal.setAttribute('aria-hidden', String(!open));
}

function openTutorialDetail(tutorial, index = 0) {
  tutorialDetailState.tutorialId = tutorial.id;
  tutorialDetailState.slideIndex = index;
  setTutorialDetailModal(true);
  renderTutorialDetail();
}

function renderTutorialGrid() {
  const grid = document.getElementById('tutorialGrid');
  const tutorials = matchingTutorials();
  if (!tutorialState.items.length) {
    grid.innerHTML = '<div class="tutorial-empty"><span aria-hidden="true">✦</span><h2>No tutorials yet</h2><p>Add your first step-by-step guide to get started.</p></div>';
    return;
  }
  if (!tutorials.length) {
    grid.innerHTML = `<div class="tutorial-empty"><span aria-hidden="true">⌕</span><h2>No matching tutorials</h2><p>Nothing shares “${escapeTutorialText(tutorialState.search.trim())}” yet.</p></div>`;
    return;
  }
  grid.innerHTML = tutorials.map((tutorial) => {
    const slides = tutorial.slides || [];
    return `<article class="tutorial-card" data-tutorial-id="${escapeTutorialText(tutorial.id)}" tabindex="0" role="button" aria-label="Open ${escapeTutorialText(tutorial.title)} details">
      <div class="tutorial-media-shell">
        <div class="tutorial-media-stage" data-tutorial-stage aria-hidden="true"></div>
        ${slides.length > 1 ? `<button class="tutorial-slide-arrow previous" type="button" data-tutorial-prev aria-label="Previous slide">‹</button><button class="tutorial-slide-arrow next" type="button" data-tutorial-next aria-label="Next slide">›</button>` : ''}
        <div class="tutorial-slide-numbers" role="tablist" aria-label="Tutorial slides">${slides.map((slide, index) => `<button type="button" role="tab" class="tutorial-slide-number" data-tutorial-slide="${index}" aria-label="Slide ${index + 1}">${index + 1}</button>`).join('')}</div>
      </div>
      <div class="tutorial-card-copy"><div class="tutorial-card-content">${renderTutorialTags(tutorial)}<h2>${escapeTutorialText(tutorial.title)}</h2><h3 data-tutorial-slide-title hidden></h3><p data-tutorial-slide-description hidden></p></div><button class="icon-btn tutorial-edit" type="button" data-edit-tutorial="${escapeTutorialText(tutorial.id)}" aria-label="Edit ${escapeTutorialText(tutorial.title)}">Edit</button></div>
    </article>`;
  }).join('');
  grid.querySelectorAll('.tutorial-card').forEach((card) => {
    const tutorial = tutorialState.items.find((item) => item.id === card.dataset.tutorialId);
    if (!tutorial) return;
    renderTutorialCardSlide(card, tutorial, tutorialState.slideIndices.get(tutorial.id) || 0);
    card.addEventListener('click', (event) => {
      if (event.target.closest('button, video, input, textarea, a')) return;
      openTutorialDetail(tutorial, tutorialState.slideIndices.get(tutorial.id) || 0);
    });
    card.addEventListener('keydown', (event) => {
      if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openTutorialDetail(tutorial, tutorialState.slideIndices.get(tutorial.id) || 0);
    });
    card.querySelectorAll('[data-tutorial-slide]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      renderTutorialCardSlide(card, tutorial, Number(button.dataset.tutorialSlide));
    }));
    card.querySelector('[data-tutorial-prev]')?.addEventListener('click', (event) => { event.stopPropagation(); renderTutorialCardSlide(card, tutorial, (tutorialState.slideIndices.get(tutorial.id) || 0) - 1); });
    card.querySelector('[data-tutorial-next]')?.addEventListener('click', (event) => { event.stopPropagation(); renderTutorialCardSlide(card, tutorial, (tutorialState.slideIndices.get(tutorial.id) || 0) + 1); });
  });
  grid.querySelectorAll('[data-edit-tutorial]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const tutorial = tutorialState.items.find((item) => item.id === button.dataset.editTutorial);
    if (tutorial) openTutorialEditor(tutorial);
  }));
}

function renderTutorialSuggestions() {
  const suggestions = document.getElementById('tutorialSearchSuggestions');
  const matches = tutorialState.search.trim() ? matchingTutorials().slice(0, 8) : [];
  suggestions.hidden = !matches.length;
  suggestions.innerHTML = matches.map((tutorial) => `<button type="button" class="quick-day-suggestion" role="option" data-tutorial-search-id="${escapeTutorialText(tutorial.id)}"><span>${escapeTutorialText(tutorial.title)}</span><span class="meta-pill category-pill">${escapeTutorialText(tutorial.tags?.[0] || `${tutorial.slides.length} slides`)}</span></button>`).join('');
  suggestions.querySelectorAll('[data-tutorial-search-id]').forEach((button) => button.addEventListener('click', () => {
    const tutorial = tutorialState.items.find((item) => item.id === button.dataset.tutorialSearchId);
    if (!tutorial) return;
    const input = document.getElementById('tutorialSearch');
    tutorialState.search = tutorial.title;
    input.value = tutorial.title;
    suggestions.hidden = true;
    renderTutorialGrid();
    document.querySelector('.tutorial-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
}

function bindTutorialSearch() {
  const input = document.getElementById('tutorialSearch');
  const suggestions = document.getElementById('tutorialSearchSuggestions');
  input.addEventListener('input', () => { tutorialState.search = input.value; renderTutorialGrid(); renderTutorialSuggestions(); });
  input.addEventListener('focus', renderTutorialSuggestions);
  input.addEventListener('keydown', (event) => { if (event.key === 'Escape') suggestions.hidden = true; });
  input.closest('.tutorial-search-combobox').addEventListener('focusout', () => window.setTimeout(() => { if (!input.closest('.tutorial-search-combobox').contains(document.activeElement)) suggestions.hidden = true; }, 0));
}

function slideEditorMarkup(slide = {}, index = 0, isNew = false) {
  const normalized = normalizeSlide(slide, index);
  return `<div class="tutorial-slide-editor" data-slide-editor data-existing-path="${escapeTutorialText(normalized.storage_path)}" data-existing-type="${escapeTutorialText(normalized.media_type)}">
    <div class="tutorial-slide-editor-header"><strong>Slide ${index + 1}</strong><button type="button" class="icon-btn" data-remove-tutorial-slide>Remove</button></div>
    <label class="tutorial-file-field"><span>${isNew || !normalized.storage_path ? 'Photo or video' : 'Replace photo or video'}</span><input type="file" accept="image/*,video/*" data-slide-file ${isNew || !normalized.storage_path ? 'required' : ''} /><small>${normalized.storage_path ? 'Leave blank to keep the current media.' : 'Choose a photo or video for this step.'}</small></label>
    <label><span>Slide title <small>(optional)</small></span><input type="text" data-slide-title value="${escapeTutorialText(normalized.title)}" placeholder="e.g. Lock the patio door" /></label>
    <label><span>Written description <small>(optional)</small></span><textarea rows="3" data-slide-description placeholder="Add the detail someone needs to complete this step.">${escapeTutorialText(normalized.description)}</textarea></label>
  </div>`;
}

function renderSlideEditors(slides = [{ id: 'slide-1' }]) {
  const list = document.querySelector('[data-tutorial-slide-editor-list]');
  list.innerHTML = slides.map((slide, index) => slideEditorMarkup(slide, index, !slide.storage_path)).join('');
  updateSlideEditorLabels();
}

function updateSlideEditorLabels() {
  document.querySelectorAll('[data-slide-editor]').forEach((editor, index) => {
    const label = editor.querySelector('.tutorial-slide-editor-header strong');
    if (label) label.textContent = `Slide ${index + 1}`;
    const input = editor.querySelector('[data-slide-file]');
    if (input) input.required = !editor.dataset.existingPath;
  });
}

function resetTutorialEditor() {
  const form = document.getElementById('tutorialForm');
  form.reset();
  form.elements.tutorialId.value = '';
  document.getElementById('tutorialModalTitle').textContent = 'Add a tutorial';
  form.querySelector('[type="submit"]').textContent = 'Save tutorial';
  form.querySelector('[data-delete-tutorial]').hidden = true;
  renderSlideEditors([{ id: 'slide-1' }]);
  form.querySelector('[data-tutorial-status]').textContent = '';
}

function openTutorialEditor(tutorial) {
  const form = document.getElementById('tutorialForm');
  form.reset();
  form.elements.tutorialId.value = tutorial.id;
  form.elements.title.value = tutorial.title;
  form.querySelectorAll('input[name="tags"]').forEach((input) => { input.checked = tutorial.tags.includes(input.value); });
  document.getElementById('tutorialModalTitle').textContent = 'Edit tutorial';
  form.querySelector('[type="submit"]').textContent = 'Save changes';
  form.querySelector('[data-delete-tutorial]').hidden = false;
  renderSlideEditors(tutorial.slides.length ? tutorial.slides : [{ id: 'slide-1' }]);
  setTutorialModal(true);
}

function collectTutorialForm() {
  const form = document.getElementById('tutorialForm');
  const slides = [...form.querySelectorAll('[data-slide-editor]')].map((editor, index) => ({
    id: editor.dataset.existingPath ? editor.querySelector('[data-slide-file]').dataset.slideId || `slide-${index + 1}` : `slide-${index + 1}`,
    storage_path: editor.dataset.existingPath,
    media_type: editor.dataset.existingType,
    file: editor.querySelector('[data-slide-file]').files[0] || null,
    title: editor.querySelector('[data-slide-title]').value.trim(),
    description: editor.querySelector('[data-slide-description]').value.trim()
  }));
  return {
    id: form.elements.tutorialId.value.trim() || `tutorial-${crypto.randomUUID()}`,
    title: form.elements.title.value.trim(),
    tags: [...form.querySelectorAll('input[name="tags"]:checked')].map((input) => input.value),
    slides
  };
}

function setTutorialModal(open) {
  const modal = document.getElementById('tutorialModal');
  modal.classList.toggle('hidden', !open);
  modal.setAttribute('aria-hidden', String(!open));
  if (open) window.setTimeout(() => document.getElementById('tutorialForm').elements.title.focus(), 0);
}

async function renderTutorials() {
  const grid = document.getElementById('tutorialGrid');
  try {
    tutorialState.items = await listSharedTutorials();
    renderTutorialTagNav();
    renderTutorialGrid();
    renderTutorialSuggestions();
  } catch (error) {
    console.error('Could not load shared tutorials', error);
    grid.innerHTML = '<div class="tutorial-empty"><h2>Shared tutorials need to be connected</h2><p>Run the latest Supabase setup, then refresh this page.</p></div>';
  }
}

async function refreshSharedTutorials() {
  if (!supabaseConfig?.url || !supabaseConfig?.publishableKey || document.visibilityState !== 'visible' || tutorialRefreshPromise) return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  tutorialRefreshPromise = renderTutorials()
    .catch((error) => console.warn('Background tutorial refresh failed', error))
    .finally(() => { tutorialRefreshPromise = null; });
  await tutorialRefreshPromise;
}

function startSharedTutorialRefresh() {
  if (!supabaseConfig?.url || !supabaseConfig?.publishableKey) return;
  window.setInterval(refreshSharedTutorials, SHARED_REFRESH_INTERVAL_MS);
  window.addEventListener('focus', refreshSharedTutorials);
  window.addEventListener('online', refreshSharedTutorials);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSharedTutorials();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('tutorialForm');
  startSharedTutorialRefresh();
  bindTutorialSearch();
  resetTutorialEditor();
  document.querySelector('[data-open-tutorial-modal]').addEventListener('click', () => { resetTutorialEditor(); setTutorialModal(true); });
  document.querySelectorAll('[data-close-tutorial-modal]').forEach((button) => button.addEventListener('click', () => setTutorialModal(false)));
  document.querySelectorAll('[data-close-tutorial-detail]').forEach((button) => button.addEventListener('click', () => setTutorialDetailModal(false)));
  document.querySelector('[data-tutorial-detail-prev]').addEventListener('click', () => {
    if (tutorialDetailState.slideIndex <= 0) return;
    scrollTutorialDetailTo(tutorialDetailState.slideIndex - 1);
  });
  document.querySelector('[data-tutorial-detail-next]').addEventListener('click', () => {
    const tutorial = tutorialState.items.find((item) => item.id === tutorialDetailState.tutorialId);
    if (!tutorial || tutorialDetailState.slideIndex >= tutorial.slides.length - 1) return;
    scrollTutorialDetailTo(tutorialDetailState.slideIndex + 1);
  });
  document.addEventListener('click', (event) => {
    const addSlide = event.target.closest('[data-add-tutorial-slide]');
    if (addSlide) {
      event.preventDefault();
      const list = document.querySelector('[data-tutorial-slide-editor-list]');
      if (list) {
        list.insertAdjacentHTML('beforeend', slideEditorMarkup({ id: `slide-${list.children.length + 1}` }, list.children.length, true));
        updateSlideEditorLabels();
      }
      return;
    }
    const remove = event.target.closest('[data-remove-tutorial-slide]');
    if (!remove) return;
    const list = document.querySelector('[data-tutorial-slide-editor-list]');
    if (list.children.length <= 1) return;
    remove.closest('[data-slide-editor]').remove();
    updateSlideEditorLabels();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setTutorialModal(false);
    setTutorialDetailModal(false);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-tutorial-status]');
    const submit = form.querySelector('[type="submit"]');
    const payload = collectTutorialForm();
    if (!payload.title || !payload.slides.length) return;
    submit.disabled = true;
    status.textContent = `Uploading ${payload.slides.length} slide${payload.slides.length === 1 ? '' : 's'} for everyone…`;
    try {
      const previousTutorial = tutorialState.items.find((item) => item.id === payload.id) || null;
      await saveSharedTutorial({ ...payload, previousTutorial });
      form.reset();
      status.textContent = '';
      setTutorialModal(false);
      await renderTutorials();
    } catch (error) {
      console.error('Could not save tutorial', error);
      status.textContent = 'This tutorial could not be saved. Check the shared Supabase setup, file size, and connection.';
    } finally {
      submit.disabled = false;
    }
  });
  form.querySelector('[data-delete-tutorial]').addEventListener('click', async () => {
    const tutorialId = form.elements.tutorialId.value.trim();
    const tutorial = tutorialState.items.find((item) => item.id === tutorialId);
    if (!tutorial || !window.confirm(`Delete “${tutorial.title}”? This will remove the tutorial and its media for everyone.`)) return;
    const deleteButton = form.querySelector('[data-delete-tutorial]');
    const status = form.querySelector('[data-tutorial-status]');
    deleteButton.disabled = true;
    status.textContent = 'Deleting tutorial…';
    try {
      await deleteSharedTutorial(tutorial);
      setTutorialModal(false);
      resetTutorialEditor();
      await renderTutorials();
    } catch (error) {
      console.error('Could not delete tutorial', error);
      status.textContent = 'This tutorial could not be deleted. Check the shared Supabase setup and connection.';
    } finally {
      deleteButton.disabled = false;
    }
  });
  try { await migrateDeviceTutorials(); } catch (error) { console.warn('Existing device tutorials will be migrated after shared storage is configured.', error); }
  await renderTutorials();
});
