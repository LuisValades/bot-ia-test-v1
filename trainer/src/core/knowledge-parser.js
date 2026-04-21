export function parseSections(md) {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = {
        level: m[1].length,
        title: m[2].trim(),
        slug: slugify(m[2].trim()),
        body: ''
      };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);

  return sections.map(s => ({
    ...s,
    body: s.body.trim(),
    preview: s.body.trim().slice(0, 200).replace(/\n+/g, ' ')
  }));
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function replaceSection(md, titleOrSlug, newBody) {
  const sections = parseSections(md);
  const target = sections.find(s => s.slug === titleOrSlug || s.title === titleOrSlug);
  if (!target) throw new Error(`Sección no encontrada: ${titleOrSlug}`);

  const lines = md.split(/\r?\n/);
  const out = [];
  let inTarget = false;
  let replaced = false;

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const title = m[2].trim();
      if (!replaced && title === target.title && level === target.level) {
        out.push(line);
        out.push('');
        out.push(newBody.trim());
        out.push('');
        inTarget = true;
        replaced = true;
        continue;
      }
      if (inTarget && level <= target.level) {
        inTarget = false;
      }
    }
    if (!inTarget) out.push(line);
  }
  if (!replaced) throw new Error(`Sección "${target.title}" no se pudo reemplazar`);
  return out.join('\n');
}
