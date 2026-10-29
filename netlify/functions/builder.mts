import { getUser } from '@netlify/identity';
import { eq, and } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { pages } from '../../db/schema.js';
import { cleanPage } from '../../lib/builder.js';

export default async (req: Request) => {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const publicRead = req.method === 'GET' && new URL(req.url).searchParams.has('public');
    if (!publicRead) {
      const user = await getUser();
      if (!user) return reply({ error: 'Bitte erneut anmelden.' }, 401);
      if (!user.roles?.some(role => ['admin', 'editor'].includes(role))) return reply({ error: 'Dein Konto benötigt die Rolle admin oder editor. Diese kann in Netlify unter Identity beim Benutzer eingetragen werden.' }, 403);
    }
    if (!['GET', 'PUT'].includes(req.method)) return reply({ error: 'Methode nicht erlaubt.' }, 405);
    const db = database();
    if (req.method === 'GET') {
      const [page] = await db.select().from(pages).where(eq(pages.id, 'home'));
      return reply(publicRead ? { page: page?.published ?? null } : { page: page?.draft ?? null, revision: page?.revision ?? 0, published: !!page?.published });
    }
    if (req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Unzulässiger Ursprung.' }, 403);
    const raw = await req.text();
    if (raw.length > 2200000) return reply({ error: 'Die Seite ist zu groß.' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Ungültige Anfrage.' }, 400); }
    let content;
    try { content = cleanPage(body.page); } catch (e) { return reply({ error: (e as Error).message }, 400); }
    if (!Number.isInteger(body.revision) || body.revision < 0 || !['draft', 'publish'].includes(body.action)) return reply({ error: 'Ungültige Version oder Aktion.' }, 400);
    const values = { draft: content, ...(body.action === 'publish' ? { published: content } : {}), updatedAt: new Date() };
    let saved;
    if (body.revision === 0) {
      [saved] = await db.insert(pages).values({ id: 'home', ...values }).onConflictDoNothing().returning();
    } else {
      [saved] = await db.update(pages).set({ ...values, revision: body.revision + 1 }).where(and(eq(pages.id, 'home'), eq(pages.revision, body.revision))).returning();
    }
    if (!saved) return reply({ error: 'Die Seite wurde inzwischen in einem anderen Fenster gespeichert. Bitte sichere deine Änderungen über Export und lade die Seite neu.' }, 409);
    return reply({ revision: saved.revision, published: !!saved.published });
  } catch {
    return reply({ error: 'Speichern oder Laden ist gerade nicht möglich. Bitte später erneut versuchen.' }, 503);
  }
};
export const config = { path: '/api/builder' };
