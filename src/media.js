import axios from 'axios';
import { openrouter } from './openrouter.js';

const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'openai/gpt-4o-mini-audio-preview';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB por attachment

export async function processAttachments(rawList = []) {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];
  const out = [];
  for (const item of rawList) {
    const processed = await processOne(item).catch(err => ({
      kind: 'error',
      url: urlOf(item),
      error: err.message
    }));
    if (processed) out.push(processed);
  }
  return out;
}

function urlOf(item) {
  return typeof item === 'string' ? item : (item?.url || item?.link || item?.href || null);
}

async function processOne(item) {
  const url = urlOf(item);
  if (!url) return null;

  const { data, headers } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES
  });
  const buffer = Buffer.from(data);
  const mime = normalizeMime((headers['content-type'] || '').split(';')[0].trim()) || inferFromUrl(url);
  const base64 = buffer.toString('base64');

  if (mime.startsWith('image/')) {
    return { kind: 'image', mime, base64, url, bytes: buffer.length };
  }
  if (mime === 'application/pdf') {
    return { kind: 'pdf', mime, base64, url, bytes: buffer.length };
  }
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    const transcript = await transcribeAudio({ base64, mime }).catch(err => {
      console.error('[media] transcribe err:', err.response?.data || err.message);
      return null;
    });
    return {
      kind: 'audio',
      mime,
      url,
      bytes: buffer.length,
      transcript: transcript || '(no se pudo transcribir este audio)'
    };
  }
  return { kind: 'other', mime, url, bytes: buffer.length };
}

function normalizeMime(m) {
  if (!m) return '';
  const lower = m.toLowerCase();
  if (lower === 'audio/mp3' || lower === 'audio/mpeg3') return 'audio/mpeg';
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

function inferFromUrl(url) {
  const clean = url.split('?')[0];
  const ext = clean.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'video/mp4',
    ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
    webm: 'audio/webm', amr: 'audio/amr', aac: 'audio/aac'
  };
  return map[ext] || 'application/octet-stream';
}

async function transcribeAudio({ base64, mime }) {
  const format = normalizeAudioFormat(mime);
  const res = await openrouter.chat.completions.create({
    model: TRANSCRIBE_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe literalmente este audio al español. Devuelve SOLO el texto transcrito, sin comentarios ni explicaciones.' },
          { type: 'input_audio', input_audio: { data: base64, format } }
        ]
      }
    ],
    max_tokens: 800,
    temperature: 0.1
  });
  return (res.choices?.[0]?.message?.content || '').trim();
}

function normalizeAudioFormat(mime) {
  const sub = mime.split('/')[1] || 'mp3';
  if (sub === 'mpeg') return 'mp3';
  if (sub === 'x-m4a' || sub === 'mp4') return 'm4a';
  return sub;
}
