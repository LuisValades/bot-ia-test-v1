import './env.js';
import express from 'express';
import cors from 'cors';
import feedbackRouter from './routes/feedback.js';
import metricsRouter from './routes/metrics.js';
import knowledgeRouter from './routes/knowledge.js';
import configRouter from './routes/config.js';
import { runtime } from './core/runtime-config.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({ origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'trainer',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    ...runtime.status()
  });
});

app.use('/api', feedbackRouter);
app.use('/api', metricsRouter);
app.use('/api', knowledgeRouter);
app.use('/api', configRouter);

app.listen(PORT, () => {
  console.log(`[trainer] listening on http://localhost:${PORT}`);
  console.log(`[trainer] model: ${process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'}`);
  console.log(`[trainer] apiKey: ${(process.env.OPENROUTER_API_KEY || '').slice(0, 15)}...`);
  console.log(`[trainer] autoCommit=${runtime.autoCommitEnabled()} autoPush=${runtime.autoPushEnabled()}`);
});
