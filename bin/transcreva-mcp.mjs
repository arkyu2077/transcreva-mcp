#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { TranscrevaClient } from './transcreva.mjs';

export const MCP_TOOLS = [
  {
    name: 'transcribe_media',
    description:
      'Transcreve um arquivo de áudio/vídeo local (MP3, M4A, WAV, OGG, OPUS, MP4, MOV, WEBM) ou URL pública usando o Transcreva.',
    inputSchema: {
      type: 'object',
      required: ['source'],
      properties: {
        source: {
          type: 'string',
          description: 'Caminho absoluto do arquivo local ou URL http(s) pública',
        },
        language: {
          type: 'string',
          description: 'Código ISO-639-1 do idioma (padrão: "pt", ou "auto", "en", "es", etc.)',
        },
        diarize: {
          type: 'boolean',
          description: 'Identificar diferentes falantes (padrão: false)',
        },
        format: {
          type: 'string',
          enum: ['txt', 'srt', 'vtt', 'json', 'docx'],
          description: 'Formato de retorno (padrão: "txt")',
        },
        timestamps: {
          type: 'boolean',
          description: 'Incluir marcações de tempo no texto (padrão: true)',
        },
        speakers: {
          type: 'boolean',
          description: 'Incluir rótulos dos falantes no texto (padrão: true)',
        },
        outputPath: {
          type: 'string',
          description: 'Caminho local opcional para salvar o arquivo exportado (.txt, .srt, .vtt, .docx)',
        },
        wait: {
          type: 'boolean',
          description: 'Aguardar conclusão da transcrição (padrão: true)',
        },
      },
    },
  },
  {
    name: 'get_transcription',
    description: 'Consulta o status ou exporta o resultado de uma transcrição existente pelo ID.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID da transcrição' },
        format: {
          type: 'string',
          enum: ['txt', 'srt', 'vtt', 'json', 'docx'],
          description: 'Formato de exportação (padrão: "txt")',
        },
        timestamps: { type: 'boolean', description: 'Incluir marcações de tempo (padrão: true)' },
        speakers: { type: 'boolean', description: 'Incluir nomes dos falantes (padrão: true)' },
        outputPath: { type: 'string', description: 'Caminho local opcional para salvar o arquivo' },
      },
    },
  },
  {
    name: 'list_transcriptions',
    description: 'Lista ou pesquisa as transcrições da conta no Transcreva.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filtro opcional pelo título' },
        page: { type: 'number', description: 'Página (padrão: 1)' },
        pageSize: { type: 'number', description: 'Itens por página (padrão: 20)' },
      },
    },
  },
  {
    name: 'rename_speakers',
    description: 'Renomeia o título da transcrição e/ou os nomes dos falantes (ex.: S1 -> Maria).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID da transcrição' },
        title: { type: 'string', description: 'Novo título opcional' },
        speakers: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'label'],
            properties: {
              id: { type: 'string', description: 'ID do falante (ex.: S1, S2)' },
              label: { type: 'string', description: 'Nome real do falante' },
            },
          },
        },
      },
    },
  },
  {
    name: 'delete_transcription',
    description: 'Exclui uma transcrição e seu arquivo de mídia original.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'ID da transcrição' },
      },
    },
  },
  {
    name: 'get_account_quota',
    description: 'Consulta o plano atual e o uso da conta no Transcreva.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function handleMcpMessage(client, msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  }
  const { id, method, params = {} } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'transcreva-local-mcp', version: '1.0.0' },
      },
    };
  }
  if (method.startsWith('notifications/')) {
    return null;
  }
  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
  }
  if (method === 'tools/call') {
    const name = params.name;
    const args = params.arguments || {};
    try {
      if (name === 'transcribe_media') {
        const format = args.format || 'txt';
        const res = await client.transcribeMedia(args.source, {
          language: args.language || 'pt',
          diarize: Boolean(args.diarize),
          format,
          timestamps: args.timestamps !== false,
          speakers: args.speakers !== false,
          wait: args.wait !== false,
        });
        if (args.wait === false) {
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] },
          };
        }
        if (args.outputPath) {
          const dest = resolve(args.outputPath);
          await writeFile(dest, res.output);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Transcrição concluída (ID: ${res.id}) e salva em ${dest}`,
                },
              ],
            },
          };
        }
        const text =
          res.output instanceof Uint8Array
            ? `DOCX gerado (${res.output.byteLength} bytes, ID: ${res.id}). Use outputPath para salvar em disco.`
            : `# ID: ${res.id}\n\n${res.output}`;
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
        };
      }
      if (name === 'get_transcription') {
        const detail = await client.getTranscription(args.id);
        if (detail.status !== 'done') {
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] },
          };
        }
        const format = args.format || 'txt';
        const out = await client.exportTranscription(args.id, {
          format,
          timestamps: args.timestamps !== false,
          speakers: args.speakers !== false,
        });
        if (args.outputPath) {
          const dest = resolve(args.outputPath);
          await writeFile(dest, out);
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: `Salvo em ${dest}` }] },
          };
        }
        const text =
          out instanceof Uint8Array
            ? `DOCX (${out.byteLength} bytes). Passe outputPath para salvar em disco.`
            : out;
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] },
        };
      }
      if (name === 'list_transcriptions') {
        const list = await client.listTranscriptions({
          page: args.page || 1,
          pageSize: args.pageSize || 20,
          search: args.search || '',
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] },
        };
      }
      if (name === 'rename_speakers') {
        const updated = await client.renameSpeakers(args.id, {
          title: args.title,
          speakers: args.speakers,
        });
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] },
        };
      }
      if (name === 'delete_transcription') {
        await client.deleteTranscription(args.id);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify({ id: args.id, deleted: true }) }] },
        };
      }
      if (name === 'get_account_quota') {
        const quota = await client.getQuota();
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(quota, null, 2) }] },
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: err.message || String(err) }], isError: true },
      };
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

function startStdioServer() {
  const client = new TranscrevaClient();
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`
      );
      return;
    }
    const res = await handleMcpMessage(client, msg);
    if (res) {
      process.stdout.write(`${JSON.stringify(res)}\n`);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  startStdioServer();
}
