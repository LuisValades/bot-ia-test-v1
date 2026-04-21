import express from 'express';
import { runtime } from '../core/runtime-config.js';

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    trainerUrl: `http://localhost:${process.env.PORT || 4000}`,
    ...runtime.status()
  });
});

router.post('/config', (req, res) => {
  const { autoCommit, autoPush } = req.body || {};
  if (typeof autoCommit !== 'undefined') runtime.setAutoCommit(autoCommit === null ? null : !!autoCommit);
  if (typeof autoPush !== 'undefined') runtime.setAutoPush(autoPush === null ? null : !!autoPush);
  res.json({ ok: true, ...runtime.status() });
});

export default router;
