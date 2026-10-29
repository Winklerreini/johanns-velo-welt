import { login, logout, getUser, handleAuthCallback, acceptInvite, updateUser, requestPasswordRecovery } from './vendor/identity.js';
const $ = id => document.getElementById(id);
let editor, revision = 0, dirty = false, initializing = false, inviteToken, busy = false;
const status = text => { $('status').textContent = text; };
const message = text => { $('login-message').textContent = text; };
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.hidden = true;
document.body.appendChild(fileInput);

async function uploadBuilderImage(file) {
  if (file.size > 4000000) throw new Error('Bilder dürfen höchstens 4 MB groß sein.');
  const response = await fetch('/api/media', { method: 'POST', body: file, credentials: 'same-origin', headers: { 'Content-Type': file.type } });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const url = Array.isArray(data.data) ? data.data[0] : data.data;
  if (!url) throw new Error('Bild konnte nicht hochgeladen werden.');
  editor?.AssetManager.add(url);
  return url;
}

async function api(url, options = {}) {
  await getUser();
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Die Anfrage ist fehlgeschlagen.');
  return data;
}
async function template() {
  const response = await fetch('/admin/template.html');
  if (!response.ok) throw new Error('Ausgangsseite konnte nicht geladen werden.');
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  return { html: doc.body.innerHTML, css: doc.querySelector('style').textContent, title: 'Johanns Velo Welt' };
}
function apply(page) {
  initializing = true;
  editor.setComponents(page.html);
  editor.setStyle(page.css);
  $('page-title').value = page.title;
  editor.UndoManager.clear();
  initializing = false;
  dirty = false;
}
function block(id, label, content) { editor.BlockManager.add(id, { label, category: 'Bausteine', content }); }
async function replaceSelectedImage(component) {
  if (!component || !component.is('image')) return;
  const picker = fileInput;
  picker.value = '';
  const file = await new Promise((resolve, reject) => {
    picker.onchange = () => {
      const selected = picker.files?.[0];
      if (!selected) reject(new Error('Kein Bild ausgewählt.'));
      else resolve(selected);
    };
    picker.click();
  });
  const url = await uploadBuilderImage(file);
  component.set('src', url);
  const currentStyle = component.getStyle() || {};
  component.setStyle({
    ...currentStyle,
    display: currentStyle.display || 'block',
    width: currentStyle.width || '100%',
    height: currentStyle.height || 'auto',
    'max-width': currentStyle['max-width'] || '100%',
    'object-fit': currentStyle['object-fit'] || 'cover',
  });
  status('Bild ersetzt · gleiche Stelle und Größe beibehalten.');
}
async function openStudio() {
  const data = await api('/api/builder');
  const page = data.page || await template();
  revision = data.revision;
  $('login-screen').hidden = true;
  $('workspace').hidden = false;
  if (editor) { apply(page); return; }
  editor = grapesjs.init({
    container: '#editor', height: '100%', storageManager: false, noticeOnUnload: false,
    fromElement: false, components: page.html, style: page.css,
    jsInHtml: false, allowScripts: false,
    canvas: { scripts: [], styles: [] },
    panels: { defaults: [] },
    blockManager: { appendTo: '#blocks' },
    layerManager: { appendTo: '#layers' },
    traitManager: { appendTo: '#properties' },
    selectorManager: { appendTo: '#selectors', componentFirst: true },
    deviceManager: { devices: [{ name: 'Desktop', width: '' }, { name: 'Tablet', width: '768px', widthMedia: '992px' }, { name: 'Mobil', width: '390px', widthMedia: '600px' }] },
    styleManager: { appendTo: '#styles', sectors: [
      { name: 'Layout & Spalten', open: true, properties: ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'order', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'gap'] },
      { name: 'Größe & Abstände', open: false, properties: ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'margin', 'padding'] },
      { name: 'Schrift & Text', open: false, properties: ['font-family', 'font-size', 'font-weight', 'color', 'text-align', 'line-height', 'letter-spacing', 'text-decoration', 'text-shadow'] },
      { name: 'Flächen & Rahmen', open: false, properties: ['background', 'border', 'border-radius', 'box-shadow', 'opacity', 'overflow', { property: 'object-fit', type: 'select', options: [{ id: 'cover', label: 'Cover' }, { id: 'contain', label: 'Contain' }, { id: 'fill', label: 'Fill' }, { id: 'none', label: 'None' }] }] },
      { name: 'Animation', open: false, properties: ['transition', 'transform'] },
    ] },
    assetManager: {
      assets: ['/images/website-1.jpg', '/images/website-2.jpg', '/images/website-3.jpg', '/images/website-4.jpg', '/images/uploads/imgupscaler-enhanced.jpg', '/images/uploads/4e1f614a3eec8f601fc3e2f76973fc46.jpg'],
      upload: false, uploadText: 'Bild wählen oder hier ablegen · JPG, PNG, GIF, WebP · max. 4 MB',
      uploadFile: async event => {
        const files = event.dataTransfer?.files || event.target.files;
        try {
          for (const file of files) {
            const url = await uploadBuilderImage(file);
            editor.AssetManager.add(url);
          }
          status('Bild hochgeladen. In der Mediathek doppelt anklicken, um es einzusetzen.');
        } catch (e) { status(e.message); }
      },
    },
  });
  editor.BlockManager.getAll().reset();
  new DOMParser().parseFromString(page.html, 'text/html').querySelectorAll('img[src]').forEach(img => editor.AssetManager.add(img.getAttribute('src')));
  block('section', 'Abschnitt', '<section style="padding:70px 5%;background:#f2f0e9"><h2>Neuer Abschnitt</h2><p>Hier beginnt deine Geschichte.</p></section>');
  for (const columns of [2, 3, 4]) block('columns-' + columns, columns + ' Spalten', `<section data-layout-columns="${columns}" style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:24px;padding:0 0"></section>`);
  block('container', 'Freier Container', '<div style="min-height:100px;padding:24px"></div>');
  block('heading', 'Überschrift', '<h2 style="font-size:42px;padding:12px 0">Deine Überschrift</h2>');
  block('text', 'Text', '<p style="padding:12px 0;line-height:1.6">Doppelt anklicken und deinen Text schreiben.</p>');
  block('image', 'Bild', { type: 'image', style: { width: '100%', 'min-height': '150px' } });
  block('link', 'Link / Button', '<a href="#kontakt" style="display:inline-block;padding:14px 24px;background:#bd4935;color:#fff;border-radius:30px">Mehr erfahren →</a>');
  block('divider', 'Trennlinie', '<hr style="border:0;border-top:1px solid #bbb;margin:30px 0">');
  block('spacer', 'Abstand', '<div style="height:60px"></div>');
  block('bike', 'Fahrrad-Karte', '<article style="padding:24px;border-top:1px solid #bbb"><img src="/images/uploads/4e1f614a3eec8f601fc3e2f76973fc46.jpg" alt="Fahrrad" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px"></article>');
  block('contact', 'Kontakt', '<section id="neuer-kontakt" style="padding:50px 5%"><h2>Besuch uns.</h2><p>Deine Adresse und Öffnungszeiten</p><a href="mailto:info@johannsvelowelt.de">E-Mail schreiben</a></section>');
  editor.on('component:selected', component => {
    if (!component) return;
    if (!component.getTrait('id')) component.addTrait({ type: 'text', name: 'id', label: 'Sprungmarke / ID' });
    if (component.is('image')) {
      const trait = component.getTrait('alt');
      if (trait) trait.set('label', 'Bildbeschreibung');
      const el = component.getEl();
      if (el) {
        el.style.cursor = 'pointer';
        el.onclick = () => replaceSelectedImage(component);
      }
    }
  });
  editor.on('update', () => { if (!initializing) { dirty = true; status('Ungespeicherte Änderungen'); } });
  editor.on('load', () => { dirty = false; editor.UndoManager.clear(); });
  $('page-title').value = page.title;
  status(data.published ? 'Entwurf geladen · Online-Version bleibt bis zum Veröffentlichen bestehen' : 'Ausgangsseite geladen · Bereit zum Gestalten');
}
async function save(action) {
  if (busy || !editor) return;
  busy = true;
  const buttons = [$('save'), $('publish')]; buttons.forEach(b => b.disabled = true);
  const html = editor.getHtml(), css = editor.getCss(), title = $('page-title').value;
  status(action === 'publish' ? 'Website wird veröffentlicht …' : 'Entwurf wird gespeichert …');
  try {
    const result = await api('/api/builder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, revision, page: { html, css, title } }) });
    revision = result.revision;
    dirty = editor.getHtml() !== html || editor.getCss() !== css || $('page-title').value !== title;
    status(dirty ? 'Stand gespeichert · Weitere ungespeicherte Änderungen vorhanden' : action === 'publish' ? 'Veröffentlicht · Deine Änderungen sind jetzt online' : 'Entwurf gespeichert · Änderungen sind gesichert');
  } catch (e) { status(e.message); }
  finally { busy = false; buttons.forEach(b => b.disabled = false); }
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();const button = event.submitter;button.disabled = true;
  try { message('Anmeldung läuft …'); await login($('email').value, $('password').value); $('password').value = ''; await openStudio(); message(''); } catch (e) { message(e.message); } finally { button.disabled = false; }
});
$('recover').onclick = async () => {
  if (!$('email').reportValidity() || !$('email').value) { message('Bitte zuerst deine E-Mail-Adresse eingeben.'); return; }
  try { await requestPasswordRecovery($('email').value); message('Falls ein Konto besteht, erhältst du einen Link zum Zurücksetzen.'); } catch (e) { message(e.message); }
};
$('password-form').onsubmit = async event => {
  event.preventDefault();event.submitter.disabled = true;
  try { if (inviteToken) await acceptInvite(inviteToken, $('new-password').value); else await updateUser({ password: $('new-password').value }); $('new-password').value = ''; await openStudio(); message(''); } catch (e) { message(e.message); } finally { event.submitter.disabled = false; }
};
$('logout').onclick = async () => { if (dirty && !confirm('Nicht gespeicherte Änderungen verwerfen und abmelden?')) return; try { await logout(); dirty = false; location.reload(); } catch (e) { status(e.message); }};
$('save').onclick = () => save('draft');
$('publish').onclick = () => save('publish');
$('undo').onclick = () => editor?.UndoManager.undo();
$('redo').onclick = () => editor?.UndoManager.redo();
$('page-title').oninput = () => { dirty = true; status('Ungespeicherte Änderungen'); };
$('help').onclick = () => $('guide').showModal();
$('close-help').onclick = () => $('guide').close();
$('preview').onclick = () => { const active = editor.Commands.isActive('preview'); editor[active ? 'stopCommand' : 'runCommand']('preview'); $('preview').textContent = active ? 'Vorschau' : 'Zurück'; };
$('restore').onclick = async () => {
  if (!confirm('Aktuellen Entwurf durch die veröffentlichte Website ersetzen? Bis zum Speichern kannst du die Seite neu laden, um den gespeicherten Entwurf zurückzuholen.')) return;
  try { const result = await api('/api/builder?public'); if (!result.page) throw new Error('Noch keine Online-Version aus dem Baukasten vorhanden.'); apply(result.page); dirty = true; status('Online-Version in den Editor geladen.'); } catch (e) { status(e.message); }
};
$('export').onclick = () => {
  if (!editor) return;
  const doc = document.implementation.createHTMLDocument($('page-title').value);
  doc.documentElement.lang = 'de';
  const meta = doc.createElement('meta');meta.name = 'viewport';meta.content = 'width=device-width, initial-scale=1';doc.head.append(meta);
  const style = doc.createElement('style');style.textContent = editor.getCss();doc.head.append(style);doc.body.innerHTML = editor.getHtml();
  const url = URL.createObjectURL(new Blob(['<!doctype html>' + doc.documentElement.outerHTML], { type: 'text/html' }));
  const a = document.createElement('a');a.href = url;a.download = 'velo-website.html';a.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelectorAll('[data-device]').forEach(button => button.onclick = () => {
  editor?.setDevice(button.dataset.device);document.querySelectorAll('[data-device]').forEach(b => b.classList.toggle('active', b === button));
});
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b === button);b.setAttribute('aria-selected', String(b === button)); $(b.dataset.tab).hidden = b !== button; });
});
addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
try {
  const callback = await handleAuthCallback();
  if (callback?.type === 'invite' || callback?.type === 'recovery') {
    inviteToken = callback.token; $('login-form').hidden = true; $('password-form').hidden = false; $('recover').hidden = true; message('Bitte ein neues Passwort festlegen.');
  } else if (await getUser()) await openStudio();
} catch (e) { message(e.message); }
