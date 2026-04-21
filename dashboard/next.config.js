const path = require('path');
const { config } = require('dotenv');

config({ path: path.resolve(__dirname, '.env.local'), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    TRAINER_URL: process.env.TRAINER_URL
  }
};

module.exports = nextConfig;
