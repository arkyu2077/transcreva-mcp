---
name: transcreva
description: Transcribe audio and video files (MP3, M4A, WAV, OGG, OPUS, AAC, FLAC, MP4, MOV, WEBM) into timestamped text, SRT/VTT subtitles, or DOCX in Brazilian Portuguese and 12+ languages with speaker diarization using Transcreva (https://transcreva.net).
license: MIT
---

# Transcreva — Audio & Video Transcription Skill

Transcribe audio and video files into accurate, timestamped text, `.srt`/`.vtt` subtitles, or `.docx` documents with [Transcreva](https://transcreva.net). Optimized for Brazilian Portuguese (`pt`, default) with support for 12+ languages (`auto`, `en`, `es`, `fr`, `it`, `de`, `ja`, `zh`, `ko`, `ru`, `ar`, `hi`) and speaker diarization (`diarize: true`).

## Requirements

- `TRANSCREVA_API_KEY` in the environment. Generate a key (`sk_...`) at [transcreva.net/conta](https://transcreva.net/conta) under **Chaves de API e MCP** (included in the [Ilimitado plan](https://transcreva.net/precos)).
- Node.js 18+ or `curl`.
- Supported formats: MP3, M4A, WAV, OGG, OPUS, AAC, FLAC, MP4, MOV, WEBM (up to 10 hours / 2 GB per file).

If the Transcreva MCP server (`https://transcreva.net/api/mcp` or `npx -y transcreva-mcp`) is connected, prefer calling its MCP tools (`transcribe_media`, `get_transcription`, `list_transcriptions`, `rename_speakers`, `get_account_quota`) directly.

## Quick CLI Usage

```bash
# Transcribe a local audio/video file or public URL to Portuguese text
npx -y transcreva-mcp transcribe /path/to/reuniao.m4a

# Transcribe an interview with speaker diarization and export to Word (.docx)
npx -y transcreva-mcp transcribe /path/to/entrevista.mp4 --speakers --format docx --out ./entrevista.docx

# Generate SRT or VTT subtitles for a video
npx -y transcreva-mcp transcribe /path/to/video.mp4 --format srt --out ./video.srt

# Rename speakers after inspecting the transcript
npx -y transcreva-mcp rename <id> --title "Reunião Semanal" --speaker S1="Maria" --speaker S2="João"

# Check account plan & usage
npx -y transcreva-mcp quota
```

## REST API Workflow

1. **Check account quota**:
   ```bash
   curl -s https://transcreva.net/api/me/usage \
     -H "Authorization: Bearer $TRANSCREVA_API_KEY"
   ```

2. **Export a completed transcription** (`txt`, `srt`, `vtt`, `docx`, or `json`):
   ```bash
   curl -s "https://transcreva.net/api/transcriptions/${ID}/export?format=srt" \
     -H "Authorization: Bearer $TRANSCREVA_API_KEY" -o legendas.srt
   ```

3. **Rename title or speaker labels**:
   ```bash
   curl -s -X PATCH "https://transcreva.net/api/transcriptions/${ID}" \
     -H "Authorization: Bearer $TRANSCREVA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"title": "Entrevista Final", "speakers": [{"id": "S1", "label": "João Silva"}]}'
   ```
