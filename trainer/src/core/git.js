import { simpleGit } from 'simple-git';

export async function commitAndPush(agent, { filePath, feedbackSummary }) {
  if (process.env.GIT_AUTO_COMMIT !== 'true') {
    return { committed: false, reason: 'GIT_AUTO_COMMIT=false' };
  }

  const git = simpleGit(agent.path);
  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) {
    return { committed: false, reason: `${agent.path} no es un repo git` };
  }

  const relPath = filePath.replace(`${agent.path}`, '').replace(/^[\\/]+/, '');
  await git.add(relPath);

  const status = await git.status();
  if (status.staged.length === 0) {
    return { committed: false, reason: 'sin cambios staged' };
  }

  const message = `trainer: ${feedbackSummary.slice(0, 70)}\n\nFeedback humano aplicado automáticamente por Trainer.`;
  const commit = await git.commit(message);

  let pushed = false;
  if (process.env.GIT_AUTO_PUSH === 'true') {
    try {
      await git.push();
      pushed = true;
    } catch (err) {
      return { committed: true, pushed: false, commitSha: commit.commit, pushError: err.message };
    }
  }

  return { committed: true, pushed, commitSha: commit.commit };
}
