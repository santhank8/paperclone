#!/usr/bin/env node
/**
 * lmstudio-bridge.mjs
 *
 * Lightweight HTTP bridge: translates Paperclip HTTP adapter payloads into
 * LM Studio's OpenAI-compatible API. No auth, local-only by design.
 *
 * Env vars:
 *   LMSTUDIO_BRIDGE_PORT   default: 3199
 *   LMSTUDIO_BASE_URL      default: http://127.0.0.1:1234
 *   LMSTUDIO_MODEL         default: qwen/qwen3.5-35b-a3b
 *
 * Per-request model override: set payload.model to target a specific model.
 */
import http from 'node:http';

const PORT = Number(process.env.LMSTUDIO_BRIDGE_PORT || 3199);
const LM_BASE = (process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234').replace(/\/$/, '');
const DEFAULT_MODEL = process.env.LMSTUDIO_MODEL || 'qwen/qwen3.5-35b-a3b';

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4_000_000) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function extractPrompt(payload) {
  const ctx = payload?.context ?? payload ?? {};
  const issue = ctx?.issue ?? {};
  const candidates = [
    payload?.prompt,
    payload?.message,
    payload?.text,
    ctx?.prompt,
    ctx?.message,
    ctx?.text,
    ctx?.commentText,
    ctx?.wakeReason,
    issue?.title,
    issue?.description,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0);
  if (candidates.length > 0) return candidates[0].trim();
  return `You are an AI agent invoked by Paperclip. Respond helpfully and concisely to the following context:\n\n${JSON.stringify(ctx, null, 2)}`;
}

function stripReasoning(text) {
  if (!text) return text;
  // Remove <think>...</think> blocks common in reasoning models
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function truncate(v, max = 500) {
  if (!v) return v;
  return v.length > max ? v.slice(0, max) + '…' : v;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  try {
    const payload = await readJson(req);

    // Model selection: payload.model > env var > default
    const model = payload?.model ?? DEFAULT_MODEL;
    const prompt = extractPrompt(payload);
    const systemPrompt = payload?.systemPrompt
      ?? 'You are a practical local AI worker inside Paperclip. Be concise, accurate, and action-oriented.';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let lmRes;
    try {
      lmRes = await fetch(`${LM_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: payload?.temperature ?? 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!lmRes.ok) {
      const errText = await lmRes.text();
      res.writeHead(502, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: `LM Studio HTTP ${lmRes.status}`, detail: errText.slice(0, 300) }));
    }

    const lmJson = await lmRes.json().catch(() => ({}));
    const rawContent = lmJson?.choices?.[0]?.message?.content?.trim() ?? '';
    const rawReasoning = lmJson?.choices?.[0]?.message?.reasoning_content?.trim() ?? null;

    // Strip inline <think> blocks from displayed result; keep reasoning separate
    const result = stripReasoning(rawContent) || rawContent;
    const summary = truncate(result);

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      summary,
      result,
      message: result,
      model,
      reasoning: rawReasoning,
      usage: lmJson?.usage ?? null,
      ok: true,
    }));
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    const isConnRefused = err?.cause?.code === 'ECONNREFUSED' || String(err).includes('ECONNREFUSED');
    const msg = isTimeout
      ? 'LM Studio request timed out after 120s'
      : isConnRefused
        ? `Cannot reach LM Studio at ${LM_BASE} — is it running?`
        : (err instanceof Error ? err.message : String(err));
    res.writeHead(isConnRefused ? 503 : 500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[lmstudio-bridge] listening on http://127.0.0.1:${PORT}`);
  console.log(`[lmstudio-bridge] forwarding to ${LM_BASE} | default model: ${DEFAULT_MODEL}`);
  console.log(`[lmstudio-bridge] override model per-agent via adapterConfig.payloadTemplate.model`);
});
