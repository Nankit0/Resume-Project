import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type TempJDFetch = {
  id: string;
  url: string;
  title: string;
  text: string;
  createdAt: string;
  expiresAt: string;
};

type ResumeForgeDb = {
  jdFetches?: TempJDFetch[];
  [key: string]: unknown;
};

const DB_PATH = fileURLToPath(new URL('./db.json', import.meta.url));
const JD_FETCH_TTL_MS = 10 * 60 * 1000;

function createJdFetchPlugin(): Plugin {
  return {
    name: 'jd-url-fetch-api',
    configureServer(server) {
      attachJdFetchMiddleware(server.middlewares.use.bind(server.middlewares));
    },
    configurePreviewServer(server) {
      attachJdFetchMiddleware(server.middlewares.use.bind(server.middlewares));
    },
  };
}

function attachJdFetchMiddleware(use: (handler: (req: any, res: any, next: () => void) => void) => void) {
  pruneExpiredJdFetches();
  setInterval(() => {
    pruneExpiredJdFetches();
  }, 60_000);

  use(async (req, res, next) => {
    if (!req.url) {
      next();
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    if (!requestUrl.pathname.startsWith('/api/jd/fetch')) {
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (req.method === 'DELETE') {
        const id = requestUrl.pathname.split('/').filter(Boolean).pop();
        if (!id) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing fetch id' }));
          return;
        }

        const removed = removeJdFetch(id);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, removed }));
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const body = await readJsonBody(req);
      const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
      if (!rawUrl) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Job URL is required' }));
        return;
      }

      const parsedUrl = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Only http and https URLs are supported' }));
        return;
      }

      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (ResumeForge JD Fetcher)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL (${response.status})`);
      }

      const html = await response.text();
      const { title, text } = extractJobDescriptionFromHtml(html);

      if (text.length < 120) {
        throw new Error('Could not extract enough job description text from this page. Try another public job page or paste the JD manually.');
      }

      const fetchedRecord: TempJDFetch = {
        id: String(Date.now()),
        url: parsedUrl.toString(),
        title: title || parsedUrl.hostname,
        text,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + JD_FETCH_TTL_MS).toISOString(),
      };

      upsertJdFetch(fetchedRecord);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(fetchedRecord));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch job description' }));
    }
  });
}

function readDb(): ResumeForgeDb {
  const raw = readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw) as ResumeForgeDb;
}

function writeDb(db: ResumeForgeDb): void {
  writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function pruneExpiredJdFetches(): void {
  const db = readDb();
  const now = Date.now();
  const current = db.jdFetches ?? [];
  const next = current.filter(item => new Date(item.expiresAt).getTime() > now);
  if (next.length !== current.length) {
    db.jdFetches = next;
    writeDb(db);
  }
}

function upsertJdFetch(fetchRecord: TempJDFetch): void {
  const db = readDb();
  const current = db.jdFetches ?? [];
  db.jdFetches = [...current.filter(item => item.id !== fetchRecord.id), fetchRecord];
  writeDb(db);
}

function removeJdFetch(id: string): boolean {
  const db = readDb();
  const current = db.jdFetches ?? [];
  const next = current.filter(item => item.id !== id);
  const removed = next.length !== current.length;
  if (removed) {
    db.jdFetches = next;
    writeDb(db);
  }
  return removed;
}

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

function extractJobDescriptionFromHtml(html: string): { title: string; text: string } {
  const title = extractPageTitle(html);
  const jsonLdDescription = extractJsonLdDescription(html);
  if (jsonLdDescription) {
    return { title, text: cleanText(jsonLdDescription) };
  }

  const metaDescription = extractMetaDescription(html);
  const bodyText = extractBodyText(html);
  const text = [metaDescription, bodyText].filter(Boolean).join('\n\n').trim();
  return { title, text: cleanText(text) };
}

function extractPageTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? decodeHtml(titleMatch[1]).trim() : '';
}

function extractMetaDescription(html: string): string {
  const metaMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["'][^>]*>/i);
  return metaMatch ? decodeHtml(metaMatch[1]).trim() : '';
}

function extractJsonLdDescription(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    const raw = script[1].trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const description = findJobPostingDescription(parsed);
      if (description) return description;
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }
  return '';
}

function findJobPostingDescription(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findJobPostingDescription(item);
      if (match) return match;
    }
    return '';
  }
  if (typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const type = record['@type'];
  const isJobPosting =
    type === 'JobPosting' ||
    (Array.isArray(type) && type.some(item => item === 'JobPosting'));

  if (isJobPosting && typeof record.description === 'string') {
    return decodeHtml(record.description);
  }

  for (const child of Object.values(record)) {
    const match = findJobPostingDescription(child);
    if (match) return match;
  }

  return '';
}

function extractBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : html;
  return decodeHtml(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function cleanText(text: string): string {
  return decodeHtml(
    text
      .replace(/\r/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    createJdFetchPlugin(),
    {
      name: 'block-db-json',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && /^\/db\.json(\?.*)?$/.test(req.url)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Forbidden');
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/db.json'],
    },
  },
})
