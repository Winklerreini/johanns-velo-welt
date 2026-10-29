import { test, expect } from '@playwright/test';
const base = 'http://localhost:8889';
async function mockEditor(page) {
  await page.route('**/admin/vendor/identity.js', route => route.fulfill({ contentType: 'application/javascript', body: `export async function getUser(){return {roles:['admin']}}; export async function handleAuthCallback(){return null};export async function login(){};export async function logout(){};export async function acceptInvite(){};export async function updateUser(){};export async function requestPasswordRecovery(){}` }));
  await page.route('**/api/builder', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { page: null, revision: 0, published: false } });
    return route.fulfill({ json: { revision: 1, published: route.request().postDataJSON().action === 'publish' } });
  });
  await page.goto(base + '/admin/');
  await expect(page.locator('.gjs-frame')).toBeAttached();
  await expect(page.locator('#status')).toContainText('Ausgangsseite geladen');
}
test('public site keeps current content and layout before first publication', async ({ page }) => {
  await page.route('**/api/builder?public', route => route.fulfill({ json: { page: null } }));
  await page.goto(base);
  await expect(page.locator('.logo')).toHaveText('sase sase');
  await expect(page.locator('.show .card')).toHaveCount(7);
  await expect(page.locator('.copy > p')).toHaveText('Fasase');
});
test('full editor loads original sections, saves draft and publishes separately', async ({ page }) => {
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  await mockEditor(page);
  await expect(page.frameLocator('.gjs-frame').locator('#kontakt')).toBeVisible();
  await page.locator('#page-title').fill('Neue Velo Welt');
  const save = page.waitForRequest(r => r.url().endsWith('/api/builder') && r.method() === 'PUT');
  await page.locator('#save').click();
  const saved = (await save).postDataJSON();
  expect(saved.action).toBe('draft');expect(saved.page.title).toBe('Neue Velo Welt');expect(saved.page.html).toContain('Samuel Rad');expect(saved.page.html).not.toContain('<script');
  await expect(page.locator('#status')).toContainText('Entwurf gespeichert');
  await page.getByRole('button', { name: 'Mobil', exact: true }).click();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('#design')).toBeVisible();
  const publish = page.waitForRequest(r => r.url().endsWith('/api/builder') && r.method() === 'PUT');
  await page.locator('#publish').click();
  expect((await publish).postDataJSON().action).toBe('publish');
  await expect(page.locator('#status')).toContainText('Veröffentlicht');
  expect(errors).toEqual([]);
});
test('API errors keep unsaved work visible', async ({ page }) => {
  await mockEditor(page);
  await page.route('**/api/builder', route => route.fulfill({ status: 409, json: { error: 'Version wurde inzwischen geändert.' } }));
  await page.locator('#page-title').fill('Nicht verlieren');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('Version wurde inzwischen geändert');
  await expect(page.locator('#page-title')).toHaveValue('Nicht verlieren');
});
test('anonymous writes are denied', async ({ request }) => {
  const response = await request.put(base + '/api/builder', { data: { page: { html: '', css: '', title: 'x' }, revision: 0, action: 'publish' } });
  expect(response.status()).toBe(401);
});
test('login loads the installed Identity client without browser errors', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base + '/admin/');
  await expect(page.locator('#login-form')).toBeVisible();
  await page.locator('#help').waitFor({ state: 'hidden' });
  expect(errors).toEqual([]);
});
test('published page replaces the starting version', async ({ page }) => {
  await page.route('**/api/builder?public', route => route.fulfill({ json: { page: { title: 'Neue Website', html: '<main><h1>Neu gestaltet</h1><a href="tel:123">Anrufen</a></main>', css: 'main{padding:40px}' } } }));
  await page.goto(base);
  await expect(page.locator('h1')).toHaveText('Neu gestaltet');
  await expect(page).toHaveTitle('Neue Website');
  await expect(page.locator('.hero')).toHaveCount(0);
});
