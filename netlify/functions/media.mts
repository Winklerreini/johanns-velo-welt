import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';

const hasRequiredMediaRole = (user: any) => {
  const rawRoles = [
    user?.role,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    ...(Array.isArray(user?.app_metadata?.user_roles) ? user.app_metadata.user_roles : []),
    user?.app_metadata?.admin,
  ].filter(Boolean).map(String).map(value => value.toLowerCase());

  return rawRoles.includes('admin') || rawRoles.includes('editor');
};

export default async (req: Request) => {
  const store = getStore('builder-images');
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(id)) return new Response('Not found', { status: 404 });
    const data = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(data.data, { headers: { 'Content-Type': String(data.metadata.contentType), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const user = await getUser();
  if (!user) return new Response('Bitte anmelden.', { status: 401 });
  if (!hasRequiredMediaRole(user)) return new Response('Dein Konto benötigt die Rolle admin oder editor. Diese kann in Netlify unter Identity beim Benutzer eingetragen werden.', { status: 403 });
  if (req.headers.get('origin') !== new URL(req.url).origin) return new Response('Forbidden', { status: 403 });
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > 4000000) return new Response('Bild darf höchstens 4 MB groß sein.', { status: 400 });
    const sig = [...bytes.slice(0, 12)];
    const type = sig[0] === 137 && sig[1] === 80 && sig[2] === 78 && sig[3] === 71 ? ['png', 'image/png'] : sig[0] === 255 && sig[1] === 216 && sig[2] === 255 ? ['jpg', 'image/jpeg'] : String.from[...]
    if (!type) return new Response('Bitte PNG, JPG, GIF oder WebP verwenden.', { status: 400 });
    const id = crypto.randomUUID() + '.' + type[0];
    await store.set(id, bytes.buffer, { metadata: { contentType: type[1] } });
    return Response.json({ data: ['/api/media?id=' + id] });
  } catch { return new Response('Bild konnte nicht hochgeladen werden.', { status: 503 }); }
};
export const config = { path: '/api/media' };
