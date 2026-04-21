import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSections, slugify } from './knowledge-parser.js';

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

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^[#\s]+/, '')
    .replace(/^\d+[.)\s]+/, '')
    .replace(/\(.+?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findSection(sections, needle) {
  if (!needle) return null;
  const exact = sections.find(s => s.title === needle);
  if (exact) return exact;
  const slug = slugify(needle);
  const bySlug = sections.find(s => s.slug === slug);
  if (bySlug) return bySlug;
  const norm = normalize(needle);
  const byNorm = sections.find(s => normalize(s.title) === norm);
  if (byNorm) return byNorm;
  const byPartial = sections.find(
    s => normalize(s.title).includes(norm) || norm.includes(normalize(s.title))
  );
  return byPartial || null;
}

export async function applyPatch(agent, patch) {
  const fileKey = patch.target_file;
  const fileName = agent.files[fileKey];
  if (!fileName) throw new Error(`Agente ${agent.id} no tiene archivo ${fileKey}`);

  const full = path.join(agent.path, fileName);
  const current = await readAgentFile(agent, fileKey);
  const backupPath = await backupFile(agent, fileKey);

  const sections = parseSections(current);
  const target = findSection(sections, patch.section_title);

  let updated;
  const cleanContent = (patch.new_content || '').trim();
  const action = patch.action || 'add_to_existing';

  if (action === 'append_section') {
    if (target) {
      throw new Error(
        `Sección "${patch.section_title}" ya existe. Usa add_to_existing o modify_section en vez de append_section.`
      );
    }
    const header = `## ${patch.section_title.trim()}`;
    const separator = current.endsWith('\n') ? '\n' : '\n\n';
    updated = `${current}${separator}${header}\n\n${cleanContent}\n`;
  } else if (action === 'modify_section') {
    if (!target) {
      throw new Error(
        `No encontré la sección "${patch.section_title}" para modify_section. Secciones disponibles: ${sections.map(s => s.title).slice(0, 10).join(', ')}`
      );
    }
    updated = replaceSectionBody(current, target, cleanContent);
  } else {
    // add_to_existing: MUST find section, otherwise error — never silently append at end
    if (!target) {
      throw new Error(
        `No encontré la sección "${patch.section_title}". Secciones disponibles: ${sections.map(s => s.title).slice(0, 10).join(', ')}`
      );
    }
    updated = appendToSection(current, target, cleanContent);
  }

  await fs.writeFile(full, updated, 'utf8');
  return {
    filePath: full,
    backupPath,
    bytesWritten: Buffer.byteLength(updated),
    resolvedSection: target?.title || patch.section_title,
    action
  };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionRegex(section) {
  const header = `${'#'.repeat(section.level)} ${escapeRegex(section.title)}`;
  return new RegExp(`(${header})([\\s\\S]*?)(?=\\n#{1,${section.level}} |$)`);
}

function appendToSection(current, target, addition) {
  const regex = sectionRegex(target);
  return current.replace(regex, (match, header, body) => {
    const trimmedBody = body.replace(/\s+$/, '');
    return `${header}${trimmedBody}\n\n${addition}\n`;
  });
}

function replaceSectionBody(current, target, newBody) {
  const regex = sectionRegex(target);
  return current.replace(regex, (_m, header) => {
    return `${header}\n\n${newBody}\n`;
  });
}
