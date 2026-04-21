import fs from 'node:fs/promises';
import path from 'node:path';

export async function readAgentFile(agent, fileKey) {
  const fileName = agent.files[fileKey];
  if (!fileName) return '';
  const full = path.join(agent.path, fileName);
  try {
    return await fs.readFile(full, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

export async function backupFile(agent, fileKey) {
  const content = await readAgentFile(agent, fileKey);
  if (!content) return null;
  const backupDir = path.resolve(process.cwd(), 'backups', agent.id);
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${fileKey}-${stamp}.md`);
  await fs.writeFile(backupPath, content, 'utf8');
  return backupPath;
}

export async function applyPatch(agent, patch) {
  const fileKey = patch.target_file;
  const fileName = agent.files[fileKey];
  if (!fileName) throw new Error(`Agente ${agent.id} no tiene archivo ${fileKey}`);

  const full = path.join(agent.path, fileName);
  const current = await readAgentFile(agent, fileKey);
  const backupPath = await backupFile(agent, fileKey);

  let updated;
  const sectionHeader = `## ${patch.section_title}`.trim();

  if (patch.action === 'append_section' || !current.includes(sectionHeader)) {
    const separator = current.endsWith('\n') ? '\n' : '\n\n';
    updated = `${current}${separator}${sectionHeader}\n\n${patch.new_content}\n`;
  } else if (patch.action === 'modify_section') {
    const regex = new RegExp(`(${escapeRegex(sectionHeader)})([\\s\\S]*?)(?=\\n## |$)`);
    updated = current.replace(regex, `$1\n\n${patch.new_content}\n`);
  } else if (patch.action === 'add_to_existing') {
    const regex = new RegExp(`(${escapeRegex(sectionHeader)})([\\s\\S]*?)(?=\\n## |$)`);
    updated = current.replace(regex, (match, header, body) => {
      return `${header}${body.replace(/\n+$/, '')}\n\n${patch.new_content}\n`;
    });
  } else {
    throw new Error(`Acción de patch desconocida: ${patch.action}`);
  }

  await fs.writeFile(full, updated, 'utf8');
  return { filePath: full, backupPath, bytesWritten: Buffer.byteLength(updated) };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
