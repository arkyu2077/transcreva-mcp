#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};

export function inferMime(filename) {
  const ext = extname(filename || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'audio/mpeg';
}

export class TranscrevaClient {
  constructor({ apiKey, baseUrl, fetchImpl } = {}) {
    this.apiKey = apiKey || process.env.TRANSCREVA_API_KEY || '';
    this.baseUrl = (baseUrl || process.env.TRANSCREVA_URL || 'https://transcreva.net').replace(/\/+$/, '');
    this.fetch = fetchImpl || globalThis.fetch;
  }

  _requireKey() {
    if (!this.apiKey) {
      throw new Error('TRANSCREVA_API_KEY is required. Generate one at https://transcreva.net/conta');
    }
  }

  async _apiJson(path, init = {}) {
    this._requireKey();
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.code !== 0) {
      const msg = json?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = json?.data;
      throw err;
    }
    return json.data;
  }

  async getQuota() {
    return this._apiJson('/api/me/usage');
  }

  async listTranscriptions({ page = 1, pageSize = 20, search = '' } = {}) {
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(search ? { search } : {}),
    });
    return this._apiJson(`/api/transcriptions?${q}`);
  }

  async getTranscription(id) {
    return this._apiJson(`/api/transcriptions/${encodeURIComponent(id)}`);
  }

  async exportTranscription(id, { format = 'txt', timestamps = true, speakers = true } = {}) {
    this._requireKey();
    const q = new URLSearchParams({
      format,
      timestamps: String(timestamps),
      speakers: String(speakers),
    });
    const res = await this.fetch(
      `${this.baseUrl}/api/transcriptions/${encodeURIComponent(id)}/export?${q}`,
      {
        headers: { authorization: `Bearer ${this.apiKey}` },
      }
    );
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.message || `Export failed with HTTP ${res.status}`);
    }
    if (format === 'docx') {
      return new Uint8Array(await res.arrayBuffer());
    }
    return res.text();
  }

  async renameSpeakers(id, { title, speakers } = {}) {
    const body = {};
    if (title !== undefined) body.title = title;
    if (speakers !== undefined) body.speakers = speakers;
    return this._apiJson(`/api/transcriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async deleteTranscription(id) {
    return this._apiJson(`/api/transcriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async _loadSource(source) {
    if (/^https?:\/\//i.test(source)) {
      const res = await this.fetch(source);
      if (!res.ok) throw new Error(`Failed to fetch media URL (${res.status}): ${source}`);
      const buffer = new Uint8Array(await res.arrayBuffer());
      const urlPath = new URL(source).pathname;
      const filename = basename(urlPath) || 'audio.mp3';
      const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim();
      const mime =
        headerMime && /^(audio|video)\//i.test(headerMime) ? headerMime : inferMime(filename);
      return { buffer, filename, size: buffer.byteLength, mime };
    }
    const abs = resolve(source);
    const info = await stat(abs);
    if (!info.isFile()) throw new Error(`Not a file: ${abs}`);
    const buffer = new Uint8Array(await readFile(abs));
    const filename = basename(abs);
    return { buffer, filename, size: buffer.byteLength, mime: inferMime(filename) };
  }

  async transcribeMedia(
    source,
    {
      language = 'pt',
      diarize = false,
      format = 'txt',
      timestamps = true,
      speakers = true,
      wait = true,
      pollIntervalMs = 2500,
      timeoutMs = 30 * 60_000,
    } = {}
  ) {
    const { buffer, filename, size, mime } = await this._loadSource(source);

    const init = await this._apiJson('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ filename, size, mime }),
    });

    if (init.putUrl) {
      const putRes = await this.fetch(init.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: buffer,
      });
      if (!putRes.ok) throw new Error(`R2 upload failed with HTTP ${putRes.status}`);
    } else if (Array.isArray(init.parts)) {
      const completedParts = [];
      for (const part of init.parts) {
        const slice = buffer.subarray(part.start, part.end);
        const putRes = await this.fetch(part.putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: slice,
        });
        if (!putRes.ok) {
          throw new Error(`R2 part ${part.partNumber} upload failed with HTTP ${putRes.status}`);
        }
        const etag = (putRes.headers.get('etag') || '').replace(/^"+|"+$/g, '');
        completedParts.push({ partNumber: part.partNumber, etag });
      }
      await this._apiJson('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({
          complete: true,
          uploadToken: init.uploadToken,
          parts: completedParts.every((p) => p.etag) ? completedParts : undefined,
        }),
      });
    } else {
      throw new Error('Unexpected response from /api/uploads');
    }

    const started = await this._apiJson('/api/transcriptions', {
      method: 'POST',
      body: JSON.stringify({
        uploadToken: init.uploadToken,
        language,
        diarize,
      }),
    });

    if (!wait) return started;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const detail = await this.getTranscription(started.id);
      if (detail.status === 'done') {
        const output = await this.exportTranscription(started.id, { format, timestamps, speakers });
        return { id: started.id, detail, output };
      }
      if (detail.status === 'failed' || detail.status === 'rejected') {
        throw new Error(`Transcription ${started.id} ${detail.status}: ${detail.errorCode || 'unknown'}`);
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Timed out waiting for transcription ${started.id}`);
  }
}

function parseFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        const k = a.slice(2, eq);
        const v = a.slice(eq + 1);
        if (k === 'speaker') (flags.speakers = flags.speakers || []).push(v);
        else flags[k] = v;
      } else {
        const k = a.slice(2);
        const next = args[i + 1];
        if (!next || next.startsWith('--')) {
          flags[k] = true;
        } else {
          if (k === 'speaker') (flags.speakers = flags.speakers || []).push(next);
          else flags[k] = next;
          i++;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const cmd = positional[0];
  if (!cmd || cmd === 'help' || flags.help) {
    process.stdout.write(
      [
        'Usage: transcreva.mjs <command> [options]',
        '',
        'Commands:',
        '  transcribe <file-or-url> [--lang pt] [--speakers] [--format txt|srt|vtt|json|docx] [--out path]',
        '  get <id> [--format txt|srt|vtt|json|docx] [--out path]',
        '  list [--search query] [--limit 20]',
        '  rename <id> [--title "Title"] [--speaker S1="Nome"]',
        '  delete <id>',
        '  quota',
        '',
        'Environment:',
        '  TRANSCREVA_API_KEY   Required (sk_... from https://transcreva.net/conta)',
        '  TRANSCREVA_URL       Optional (default: https://transcreva.net)',
        '',
      ].join('\n')
    );
    return;
  }

  const client = new TranscrevaClient();

  if (cmd === 'quota') {
    const quota = await client.getQuota();
    process.stdout.write(`${JSON.stringify(quota, null, 2)}\n`);
    return;
  }

  if (cmd === 'list') {
    const res = await client.listTranscriptions({
      pageSize: Number(flags.limit) || 20,
      search: typeof flags.search === 'string' ? flags.search : '',
    });
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return;
  }

  if (cmd === 'get') {
    const id = positional[1];
    if (!id) throw new Error('Usage: transcreva.mjs get <id>');
    const detail = await client.getTranscription(id);
    if (detail.status !== 'done') {
      process.stdout.write(`${JSON.stringify(detail, null, 2)}\n`);
      return;
    }
    const format = typeof flags.format === 'string' ? flags.format : 'txt';
    const out = await client.exportTranscription(id, {
      format,
      timestamps: flags['no-timestamps'] ? false : true,
      speakers: flags['no-speakers'] ? false : true,
    });
    if (typeof flags.out === 'string') {
      await writeFile(resolve(flags.out), out);
      process.stdout.write(`Saved to ${resolve(flags.out)}\n`);
    } else if (out instanceof Uint8Array) {
      const dest = resolve(`${id}.docx`);
      await writeFile(dest, out);
      process.stdout.write(`Saved DOCX to ${dest}\n`);
    } else {
      process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
    }
    return;
  }

  if (cmd === 'transcribe') {
    const source = positional[1];
    if (!source) throw new Error('Usage: transcreva.mjs transcribe <file-or-url>');
    const format = typeof flags.format === 'string' ? flags.format : 'txt';
    const res = await client.transcribeMedia(source, {
      language: typeof flags.lang === 'string' ? flags.lang : 'pt',
      diarize: Boolean(flags.speakers || flags.diarize),
      format,
      timestamps: flags['no-timestamps'] ? false : true,
      speakers: flags['no-speakers'] ? false : true,
      wait: !flags['no-wait'],
    });
    if (flags['no-wait']) {
      process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
      return;
    }
    if (typeof flags.out === 'string') {
      await writeFile(resolve(flags.out), res.output);
      process.stdout.write(`Saved (${res.id}) to ${resolve(flags.out)}\n`);
    } else if (res.output instanceof Uint8Array) {
      const dest = resolve(`${res.id}.docx`);
      await writeFile(dest, res.output);
      process.stdout.write(`Saved DOCX (${res.id}) to ${dest}\n`);
    } else {
      process.stdout.write(res.output.endsWith('\n') ? res.output : `${res.output}\n`);
    }
    return;
  }

  if (cmd === 'rename') {
    const id = positional[1];
    if (!id) throw new Error('Usage: transcreva.mjs rename <id> [--title "..."] [--speaker S1="Nome"]');
    const speakers = Array.isArray(flags.speakers)
      ? flags.speakers.map((pair) => {
          const eq = pair.indexOf('=');
          if (eq === -1) throw new Error(`Invalid --speaker format "${pair}", expected ID=Label`);
          return { id: pair.slice(0, eq).trim(), label: pair.slice(eq + 1).trim() };
        })
      : undefined;
    const updated = await client.renameSpeakers(id, {
      title: typeof flags.title === 'string' ? flags.title : undefined,
      speakers,
    });
    process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
    return;
  }

  if (cmd === 'delete') {
    const id = positional[1];
    if (!id) throw new Error('Usage: transcreva.mjs delete <id>');
    await client.deleteTranscription(id);
    process.stdout.write(`Deleted ${id}\n`);
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
