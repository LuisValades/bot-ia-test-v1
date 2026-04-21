import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import express from 'express';
import cors from 'cors';
import feedbackRouter from './routes/feedback.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({
  origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'trainer',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    autoCommit: process.env.GIT_AUTO_COMMIT === 'true',
    autoPush: process.env.GIT_AUTO_PUSH === 'true'
  });
});

app.use('/api', feedbackRouter);

app.listen(PORT, () => {
  console.log(`[trainer] listening on http://localhost:${PORT}`);
  console.log(`[trainer] model: ${process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'}`);
});
