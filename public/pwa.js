if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=6').catch((error) => {
      console.warn('Offline app support could not be started.', error);
    });
  });
}
