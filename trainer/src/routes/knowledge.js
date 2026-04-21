import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAgent } from '../config/agents.js';
import { readAgentFile, backupFile } from '../core/patcher.js';
import { parseSections, replaceSection } from '../core/knowledge-parser.js';
import { commitAndPush } from '../core/git.js';

const router = express.Router();

router.get('/agents/:id/knowledge-sections', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    const knowledge = await readAgentFile(agent, 'knowledge');
    const prompt = await readAgentFile(agent, 'prompt');
    res.json({
      agent: { id: agent.id, name: agent.name },
      knowledge: {
        raw: knowledge,
        sections: parseSections(knowledge),
        bytes: Buffer.byteLength(knowledge || '')
      },
      prompt: {
        raw: prompt,
        sections: parseSections(prompt),
        bytes: Buffer.byteLength(prompt || '')
      }
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/agents/:id/section', async (req, res) => {
  const { file, slug, newBody } = req.body || {};
  if (!file || !slug || typeof newBody !== 'string') {
    return res.status(400).json({ error: 'Requerido: file (prompt|knowledge), slug, newBody' });
  }
  if (file !== 'prompt' && file !== 'knowledge') {
    return res.status(400).json({ error: 'file debe ser prompt o knowledge' });
  }

  let agent;
  try {
    agent = getAgent(req.params.id);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  try {
    const fileName = agent.files[file];
    if (!fileName) return res.status(400).json({ error: `Agente no tiene archivo ${file}` });
    const full = path.join(agent.path, fileName);

    const current = await readAgentFile(agent, file);
    const backupPath = await backupFile(agent, file);
    const updated = replaceSection(current, slug, newBody);

    await fs.writeFile(full, updated, 'utf8');

    const gitResult = await commitAndPush(agent, {
      filePath: full,
      feedbackSummary: `edit manual sección "${slug}" en ${file}.md`
    });

    res.json({
      ok: true,
      filePath: full,
      backupPath,
      bytesWritten: Buffer.byteLength(updated),
      git: gitResult
    });
  } catch (err) {
    console.error('[knowledge/section] error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
