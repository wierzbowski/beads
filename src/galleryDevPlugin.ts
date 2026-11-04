import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { normalizePath, type Plugin } from 'vite';
// With an extension, as Vite's native config loader requires for files the config imports.
import { GALLERY_ENDPOINT, GalleryFileError, readGallery, writeGalleryEntry } from './galleryFile.ts';

/**
 * Dev-server-only endpoint that lets the Creator add to `src/gallery.ts` (ADR-0005).
 * `GET` returns the gallery as it is on disk; `POST { name, payload, replace }` writes one entry.
 * Nothing is committed, and the plugin's own writes don't reload the page, so the Creator keeps its state.
 */
export function galleryDevPlugin(): Plugin {
  let file = '';
  let lastWritten: string | null = null;

  return {
    name: 'beads-gallery-dev',
    apply: 'serve',
    configResolved(config) {
      // Normalised to forward slashes, as Vite reports changed files.
      file = normalizePath(resolve(config.root, 'src/gallery.ts'));
    },
    configureServer(server) {
      server.middlewares.use(GALLERY_ENDPOINT, (req, res) => {
        handle(req, res).catch((e) => {
          const message = e instanceof GalleryFileError ? e.message : `Nie udało się zapisać src/gallery.ts: ${e}`;
          send(res, 500, { error: message });
        });
      });
    },
    hotUpdate({ file: changed, read }) {
      if (changed !== file || lastWritten === null) return;
      return Promise.resolve(read()).then((content) => (content === lastWritten ? [] : undefined));
    },
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method === 'GET') {
      return send(res, 200, { entries: readGallery(await readFile(file, 'utf8')) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Nieobsługiwana metoda.' });
    const { name, payload, replace } = JSON.parse(await readBody(req));
    const source = await readFile(file, 'utf8');
    const written = writeGalleryEntry(source, String(name), String(payload), replace === true);
    if (written.source !== source) {
      lastWritten = written.source;
      await writeFile(file, written.source);
    }
    send(res, 200, { result: written.result });
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => done(body));
    req.on('error', fail);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
