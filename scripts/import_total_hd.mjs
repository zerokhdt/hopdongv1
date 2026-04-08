import fs from 'node:fs/promises';
import path from 'node:path';

const srcRoot = process.argv[2] || 'D:\\OneDrive\\ACE\\APP\\HOP DONG\\TOTAL HD';
const projectRoot = process.cwd();
const outTemplates = path.join(projectRoot, 'public', 'templates', 'total_hd');
const outHtml = path.join(projectRoot, 'public', 'contracts', 'total_hd');

const isWinAbs = /^[a-zA-Z]:\\/;
const absSrcRoot = isWinAbs.test(srcRoot) ? srcRoot : path.resolve(srcRoot);

const slugify = (v) => {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
};

const normalizeTitle = (name) => {
  let t = String(name || '').trim();
  t = t.replace(/^\uFEFF/, '');
  t = t.replace(/^\s*\d+\s*\.\s*/g, '');
  t = t.replace(/^\s*\d+\s*-\s*/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
};

const walk = async (dir) => {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
};

const ensureDir = async (p) => {
  await fs.mkdir(p, { recursive: true });
};

await ensureDir(outTemplates);
await ensureDir(outHtml);

const files = await walk(absSrcRoot);
const docxFiles = files.filter(f => /\.docx$/i.test(f));
const htmlFiles = files.filter(f => /\.(html|htm)$/i.test(f));

const seen = new Set();
const makeUnique = (base, ext) => {
  let name = `${base}${ext}`;
  if (!seen.has(name)) {
    seen.add(name);
    return name;
  }
  let i = 2;
  while (seen.has(`${base}_${i}${ext}`)) i++;
  name = `${base}_${i}${ext}`;
  seen.add(name);
  return name;
};

const copied = [];

for (const f of docxFiles) {
  const stem = path.basename(f, path.extname(f));
  const title = normalizeTitle(stem);
  const slug = slugify(title);
  if (!slug) continue;
  const fileName = makeUnique(slug, '.docx');
  const dest = path.join(outTemplates, fileName);
  await fs.copyFile(f, dest);
  copied.push({ kind: 'docx', title, slug: fileName, dest: path.relative(projectRoot, dest).replace(/\\/g, '/') });
}

for (const f of htmlFiles) {
  const stem = path.basename(f, path.extname(f));
  const title = normalizeTitle(stem);
  const slug = slugify(title);
  if (!slug) continue;
  const fileName = makeUnique(slug, '.html');
  const dest = path.join(outHtml, fileName);
  await fs.copyFile(f, dest);
  copied.push({ kind: 'html', title, slug: fileName, dest: path.relative(projectRoot, dest).replace(/\\/g, '/') });
}

copied.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
await fs.writeFile(path.join(outTemplates, 'manifest.json'), JSON.stringify(copied.filter(x => x.kind === 'docx'), null, 2), 'utf8');
await fs.writeFile(path.join(outHtml, 'manifest.json'), JSON.stringify(copied.filter(x => x.kind === 'html'), null, 2), 'utf8');

process.stdout.write(`Imported TOTAL HD\n- DOCX: ${docxFiles.length}\n- HTML: ${htmlFiles.length}\n`);
