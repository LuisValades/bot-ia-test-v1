import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAgent, listAgents } from '../config/agents.js';
import { analyzeFeedback } from '../core/analyzer.js';
import { readAgentFile, applyPatch } from '../core/patcher.js';
import { commitAndPush } from '../core/git.js';

const router = express.Router();
const LOGS_DIR = path.resolve(process.cwd(), 'logs');

async function logFeedback(entry) {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n';
  await fs.appendFile(path.join(LOGS_DIR, 'feedback.jsonl'), line, 'utf8');
}

router.get('/agents', (_req, res) => {
  res.json({ agents: listAgents() });
});

router.get('/agents/:id/files', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    const prompt = await readAgentFile(agent, 'prompt');
    const knowledge = await readAgentFile(agent, 'knowledge');
    res.json({
      agent: { id: agent.id, name: agent.name, status: agent.status },
      prompt,
      knowledge,
      promptBytes: Buffer.byteLength(prompt || ''),
      knowledgeBytes: Buffer.byteLength(knowledge || '')
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/feedback', async (req, res) => {
  const { agent: agentId, conversation, badResponseIndex, feedback } = req.body || {};

  if (!agentId || !Array.isArray(conversation) || typeof badResponseIndex !== 'number' || !feedback) {
    return res.status(400).json({
      error: 'Requerido: agent, conversation (array), badResponseIndex (number), feedback (string)'
    });
  }

  let agent;
  try {
    agent = getAgent(agentId);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  if (agent.status === 'placeholder') {
    await logFeedback({ agentId, feedback, skipped: true, reason: 'agente placeholder' });
    return res.json({
      ok: true,
      skipped: true,
      reason: `El agente ${agent.name} aún no tiene archivos reales; feedback solo registrado en logs.`
    });
  }

  const badResponse = {
    index: badResponseIndex,
    content: conversation[badResponseIndex]?.content || ''
  };

  try {
    const currentPrompt = await readAgentFile(agent, 'prompt');
    const currentKnowledge = await readAgentFile(agent, 'knowledge');

    const patch = await analyzeFeedback({
      conversation,
      badResponse,
      feedback,
      currentPrompt,
      currentKnowledge
    });

    if (patch.needs_clarification) {
      await logFeedback({ agentId, feedback, skipped: true, reason: 'needs_clarification', patch });
      return res.json({ ok: true, skipped: true, needs_clarification: true, patch });
    }

    const { filePath, backupPath, bytesWritten } = await applyPatch(agent, patch);
    const gitResult = await commitAndPush(agent, { filePath, feedbackSummary: feedback });

    await logFeedback({
      agentId,
      feedback,
      patch,
      filePath,
      backupPath,
      bytesWritten,
      git: gitResult
    });

    res.json({
      ok: true,
      patchApplied: true,
      target: patch.target_file,
      section: patch.section_title,
      reasoning: patch.reasoning,
      filePath,
      backupPath,
      git: gitResult
    });
  } catch (err) {
    console.error('[feedback] error:', err);
    await logFeedback({ agentId, feedback, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
