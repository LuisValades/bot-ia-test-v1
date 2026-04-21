import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = express.Router();
const LOGS_DIR = path.resolve(process.cwd(), 'logs');

async function readFeedbackLog() {
  try {
    const content = await fs.readFile(path.join(LOGS_DIR, 'feedback.jsonl'), 'utf8');
    return content
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

router.get('/metrics', async (_req, res) => {
  try {
    const entries = await readFeedbackLog();
    const good = entries.filter(e => e.kind === 'good').length;
    const bad = entries.filter(e => e.kind !== 'good').length;
    const byAgent = {};
    for (const e of entries) {
      const id = e.agentId || 'unknown';
      byAgent[id] = byAgent[id] || { good: 0, bad: 0 };
      if (e.kind === 'good') byAgent[id].good++;
      else byAgent[id].bad++;
    }
    const byDay = {};
    for (const e of entries) {
      const d = (e.at || '').slice(0, 10);
      if (!d) continue;
      byDay[d] = byDay[d] || { good: 0, bad: 0 };
      if (e.kind === 'good') byDay[d].good++;
      else byDay[d].bad++;
    }
    res.json({
      totalFeedback: entries.length,
      good,
      bad,
      byAgent,
      byDay
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/feedback-log', async (_req, res) => {
  try {
    const entries = await readFeedbackLog();
    const recent = entries.slice(-200).reverse();
    res.json({ total: entries.length, entries: recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
