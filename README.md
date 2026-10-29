<h1 align="center">Transcreva — MCP Server, CLI & Agent Skill</h1>

<p align="center">
  Transcribe audio and video into accurate <b>Brazilian Portuguese</b> text, <b>SRT/VTT subtitles</b>, or <b>Word (DOCX)</b> documents — from your terminal, your code, or by asking Claude, Cursor, and VS Code.
</p>

<p align="center">
  <a href="https://transcreva.net"><b>transcreva.net</b></a> ·
  <a href="https://transcreva.net/precos">Pricing</a> ·
  <a href="https://transcreva.net/transcrever-audio-whatsapp">WhatsApp Audio</a> ·
  <a href="https://transcreva.net/gerar-legenda-automatica">SRT Subtitles</a> ·
  <a href="https://transcreva.net/transcricao-de-entrevista">Interview Transcription</a>
</p>

---

[Transcreva](https://transcreva.net) is an AI audio and video transcription service built for Brazilian Portuguese (`pt-BR`), with support for 12+ languages, speaker diarization (*identificação de falantes*), and instant export to **TXT, DOCX, SRT, VTT, and JSON**.

This repository provides:
1. **Remote & Local MCP Servers** for Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code
2. **Zero-dependency Node.js CLI & SDK** (`bin/transcreva.mjs`) with automatic multipart upload to R2 for files up to 2 GB / 10 hours
3. **Agent Skill** (`skills/transcreva/SKILL.md`) compatible with `npx skills add arkyu2077/transcreva-mcp`

---

## 1. Install the Agent Skill (`skills.sh`)

```bash
npx skills add arkyu2077/transcreva-mcp
```

---

## 2. MCP Server Setup

First, generate an API key (`sk_...`) in your account at **[transcreva.net/conta](https://transcreva.net/conta)** under **Chaves de API e MCP** (available on the [Ilimitado plan](https://transcreva.net/precos)).

### Option A: Remote HTTP MCP Server (`https://transcreva.net/api/mcp`)

Zero local installation required. Works with any MCP client supporting Streamable HTTP:

#### Claude Code
```bash
claude mcp add --transport http transcreva https://transcreva.net/api/mcp \
  --header "Authorization: Bearer $TRANSCREVA_API_KEY" --scope user
```

#### Cursor (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "transcreva": {
      "url": "https://transcreva.net/api/mcp",
      "headers": {
        "Authorization": "Bearer ${env:TRANSCREVA_API_KEY}"
      }
    }
  }
}
```

### Option B: Local Stdio MCP Server (Supports Local File Uploads up to 2 GB)

Use the local stdio server when you want your AI assistant to directly upload and transcribe local `.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus`, `.mp4`, `.mov`, or `.webm` files from your disk:

```json
{
  "mcpServers": {
    "transcreva": {
      "command": "node",
      "args": ["/path/to/transcreva-mcp/bin/transcreva-mcp.mjs"],
      "env": {
        "TRANSCREVA_API_KEY": "sk_..."
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
| --- | --- |
| `transcribe_media` | Uploads a local audio/video file or public URL, waits for completion, and returns the formatted transcript (`txt`, `srt`, `vtt`, `json`, `docx`) or writes it to `outputPath`. |
| `get_transcription` | Checks the status of a transcription by ID or exports the completed transcript in `txt`, `srt`, `vtt`, `json`, or `docx`. |
| `list_transcriptions` | Lists or searches your transcription history on Transcreva. |
| `rename_speakers` | Updates the transcription title and/or renames identified speaker labels (e.g. `S1` → `João Silva`). |
| `delete_transcription` | Permanently deletes a transcription and its underlying media file. |
| `get_account_quota` | Returns your current plan (`unlimited`, `pro`, `plus`) and usage metrics. |

---

## 3. Command-Line Interface (CLI)

```bash
export TRANSCREVA_API_KEY="sk_..."

# Transcribe a local file to Portuguese text with timestamps
node bin/transcreva.mjs transcribe ./reuniao.m4a

# Transcribe an interview with speaker identification and export to Word (.docx)
node bin/transcreva.mjs transcribe ./entrevista.mp4 --speakers --format docx --out ./entrevista.docx

# Generate SRT subtitles for a video
node bin/transcreva.mjs transcribe ./aula.mp4 --format srt --out ./aula.srt

# Rename speakers on an existing transcription
node bin/transcreva.mjs rename <id> --title "Ata de Reunião" --speaker S1="Maria" --speaker S2="Pedro"

# List recent transcriptions
node bin/transcreva.mjs list --search "reunião"
```

---

## Links

- **Website:** [transcreva.net](https://transcreva.net)
- **Pricing:** [transcreva.net/precos](https://transcreva.net/precos)
- **WhatsApp Audio to Text:** [transcreva.net/transcrever-audio-whatsapp](https://transcreva.net/transcrever-audio-whatsapp)
- **Video to Text:** [transcreva.net/transcrever-video](https://transcreva.net/transcrever-video)
- **Automatic Subtitle Generator (SRT/VTT):** [transcreva.net/gerar-legenda-automatica](https://transcreva.net/gerar-legenda-automatica)
- **Interview Transcription:** [transcreva.net/transcricao-de-entrevista](https://transcreva.net/transcricao-de-entrevista)
- **Audio Degravação:** [transcreva.net/degravacao-de-audio](https://transcreva.net/degravacao-de-audio)
- **LLM Index:** [transcreva.net/llms.txt](https://transcreva.net/llms.txt)

## License

MIT © SailorFlow LLC ([transcreva.net](https://transcreva.net))
