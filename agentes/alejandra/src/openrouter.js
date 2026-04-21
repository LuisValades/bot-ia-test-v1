import OpenAI from 'openai';

export const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://crediexpres.com',
    'X-Title': 'Bot Alejandra SMS'
  }
});
