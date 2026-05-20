// Carga el .env de Alejandra (fuente única de verdad de credenciales).
// El tool no tiene su propio .env: comparte GHL token, Supabase, OpenRouter.
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '..', 'alejandra', '.env') });

if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY)) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env de Alejandra');
  process.exit(1);
}
if (!process.env.GHL_API_TOKEN || !process.env.GHL_LOCATION_ID) {
  console.error('❌ Falta GHL_API_TOKEN o GHL_LOCATION_ID en .env de Alejandra');
  process.exit(1);
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

export const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

export const ghl = axios.create({
  baseURL: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

export const LOCATION_ID = process.env.GHL_LOCATION_ID;
export const LLM_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';
