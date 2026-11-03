---
layout: default
title: "Como Integrar Transcrição de Áudio em Português no Claude Code, Cursor e Node.js via MCP"
description: "Guia para desenvolvedores: conectando o servidor Model Context Protocol (MCP) e a CLI do Transcreva para transcrever áudios e vídeos automaticamente."
---

# Como Integrar Transcrição de Áudio em Português no Claude Code, Cursor e Node.js via MCP

O protocolo **MCP (Model Context Protocol)** permite que assistentes de IA como Claude Desktop, Claude Code, Cursor e Windsurf executem ferramentas externas diretamente. Com o servidor oficial do **[Transcreva (transcreva.net)](https://transcreva.net)**, seu agente pode receber um arquivo de áudio/vídeo ou URL, enviar para transcrição em português do Brasil com diarização de falantes e salvar o resultado em `.txt`, `.srt`, `.vtt` ou `.docx`.

---

## 1. Configuração rápida via Remote MCP (Streamable HTTP)

O **[Transcreva](https://transcreva.net)** oferece tanto um servidor MCP remoto quanto um pacote NPM local (`transcreva-mcp`):

```json
{
  "mcpServers": {
    "transcreva": {
      "command": "npx",
      "args": ["-y", "transcreva-mcp"],
      "env": {
        "TRANSCREVA_TOKEN": "seu_token_aqui"
      }
    }
  }
}
```

Ou via Marketplace do Claude Code:

```bash
/plugin marketplace add arkyu2077/transcreva-mcp
```

---

## 2. Casos de uso em engenharia e automação

- **Triagem de mensagens de voz do WhatsApp:** converta áudios de suporte usando o pipeline de **[transcrever áudio do WhatsApp](https://transcreva.net/transcrever-audio-whatsapp)** e gere tickets estruturados automaticamente.
- **Pipeline de publicação de vídeo:** extraia **[legendas automáticas SRT/VTT](https://transcreva.net/legenda-automatica)** e resumos de capítulos a partir de gravações brutas em **[vídeo para texto](https://transcreva.net/video-para-texto)**.
- **Análise de entrevistas e reuniões:** processe gravações longas com **[transcrição de entrevistas](https://transcreva.net/transcrever-entrevista)** e **[degravação de áudio](https://transcreva.net/degravacao-de-audio)**.

[← Voltar para a documentação principal do transcreva-mcp](../)
