(async function () {
  if (/#(?:invite|recovery|confirmation|access)_token=/.test(location.hash)) { location.replace('/admin/' + location.hash); return; }
  try {
    const response = await fetch('/api/builder?public', { cache: 'no-store' });
    if (!response.ok) return;
    const { page } = await response.json();
    if (!page) return;
    document.querySelectorAll('head style').forEach(style => style.remove());
    document.title = page.title;
    const style = document.createElement('style');style.textContent = page.css;document.head.append(style);
    document.body.innerHTML = page.html;
  } catch { /* The existing site remains available when the service is unavailable. */ }
})();
