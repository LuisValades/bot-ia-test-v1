import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAgent, listAgents } from '../config/agents.js';
import { analyzeFeedback, runConversationalAnalyzer } from '../core/analyzer.js';
import { readAgentFile, applyPatch } from '../core/patcher.js';
import { commitAndPush } from '../core/git.js';
import { runtime } from '../core/runtime-config.js';

const router = express.Router();
const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

async function logFeedback(entry) {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  const line = JSON.stringify({ id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...entry, at: new Date().toISOString() }) + '\n';
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

router.post('/feedback-good', async (req, res) => {
  const { agent: agentId, conversation, responseIndex } = req.body || {};
  try {
    await logFeedback({
      kind: 'good',
      agentId,
      responseIndex: typeof responseIndex === 'number' ? responseIndex : null,
      response: conversation?.[responseIndex]?.content?.slice(0, 500) || null
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    await logFeedback({ kind: 'bad', agentId, feedback, skipped: true, reason: 'agente placeholder' });
    return res.json({
      ok: true,
      skipped: true,
      reason: `${agent.name} aún no tiene archivos; feedback solo registrado.`
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
      await logFeedback({ kind: 'bad', agentId, feedback, skipped: true, reason: 'needs_clarification', patch });
      return res.json({ ok: true, skipped: true, needs_clarification: true, patch });
    }

    const { filePath, backupPath, bytesWritten } = await applyPatch(agent, patch);
    const gitResult = runtime.autoCommitEnabled()
      ? await commitAndPush(agent, { filePath, feedbackSummary: feedback })
      : { committed: false, reason: 'runtime override' };

    await logFeedback({
      kind: 'bad',
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
    await logFeedback({ kind: 'bad', agentId, feedback, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// --- Conversational feedback flow ---

router.post('/feedback/chat', async (req, res) => {
  const { agent: agentId, conversation, badResponseIndex, initialFeedback, chatHistory } = req.body || {};

  if (!agentId || !Array.isArray(conversation) || typeof badResponseIndex !== 'number') {
    return res.status(400).json({ error: 'Requerido: agent, conversation, badResponseIndex' });
  }

  let agent;
  try {
    agent = getAgent(agentId);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  if (agent.status === 'placeholder') {
    return res.json({
      action: 'ask',
      message: `${agent.name} aún no tiene archivos reales para entrenar. Define su rol primero.`
    });
  }

  const badResponse = {
    index: badResponseIndex,
    content: conversation[badResponseIndex]?.content || ''
  };

  try {
    const currentPrompt = await readAgentFile(agent, 'prompt');
    const currentKnowledge = await readAgentFile(agent, 'knowledge');

    const result = await runConversationalAnalyzer({
      conversation,
      badResponse,
      initialFeedback: initialFeedback || '(sin feedback inicial)',
      chatHistory: chatHistory || [],
      currentPrompt,
      currentKnowledge
    });

    res.json(result);
  } catch (err) {
    console.error('[feedback/chat] error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/feedback/apply-patch', async (req, res) => {
  const { agent: agentId, patch, feedbackSummary, chatHistory } = req.body || {};
  if (!agentId || !patch) {
    return res.status(400).json({ error: 'Requerido: agent, patch' });
  }

  let agent;
  try {
    agent = getAgent(agentId);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }

  try {
    const { filePath, backupPath, bytesWritten } = await applyPatch(agent, patch);
    const gitResult = runtime.autoCommitEnabled()
      ? await commitAndPush(agent, { filePath, feedbackSummary: feedbackSummary || patch.reasoning || 'conversational patch' })
      : { committed: false, reason: 'runtime override' };

    await logFeedback({
      kind: 'bad',
      agentId,
      feedback: feedbackSummary,
      chatHistory,
      patch,
      filePath,
      backupPath,
      bytesWritten,
      git: gitResult,
      mode: 'conversational'
    });

    res.json({
      ok: true,
      patchApplied: true,
      target: patch.target_file,
      section: patch.section_title,
      filePath,
      backupPath,
      git: gitResult
    });
  } catch (err) {
    console.error('[feedback/apply-patch] error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/rollback', async (req, res) => {
  const { backupPath, targetPath } = req.body || {};
  if (!backupPath || !targetPath) {
    return res.status(400).json({ error: 'Requerido: backupPath, targetPath' });
  }
  const resolved = path.resolve(backupPath);
  if (!resolved.startsWith(BACKUPS_DIR)) {
    return res.status(400).json({ error: 'backupPath debe estar dentro de trainer/backups/' });
  }
  try {
    const backup = await fs.readFile(resolved, 'utf8');
    await fs.writeFile(targetPath, backup, 'utf8');
    await logFeedback({
      kind: 'rollback',
      backupPath: resolved,
      targetPath,
      bytesRestored: Buffer.byteLength(backup)
    });
    res.json({ ok: true, restoredBytes: Buffer.byteLength(backup) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
