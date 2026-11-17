import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenToken = ['NIHAGENT', 'ECHO'].join('-');
const rawSpecPaths = [
  'UA-SKILLS.html',
  '01_source_structured.md',
  '02_source_raw_text.md',
];
const ignoredBinaryExtensions = new Set([
  '.ico',
  '.jar',
  '.jpg',
  '.jpeg',
  '.docx',
  '.pdf',
  '.png',
  '.webp',
  '.xlsx',
  '.zip',
]);
const ignoredDirectories = new Set([
  '.dart_tool',
  '.git',
  '.gradle',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'output',
]);
const hiddenCharacters = new Map([
  [0xfeff, 'BOM/FEFF'],
  [0x00ad, 'soft hyphen'],
  [0x061c, 'arabic letter mark'],
  [0x180e, 'mongolian vowel separator'],
  [0x200b, 'zero width space'],
  [0x200c, 'zero width non-joiner'],
  [0x200d, 'zero width joiner'],
  [0x200e, 'left-to-right mark'],
  [0x200f, 'right-to-left mark'],
  [0x202a, 'left-to-right embedding'],
  [0x202b, 'right-to-left embedding'],
  [0x202c, 'pop directional formatting'],
  [0x202d, 'left-to-right override'],
  [0x202e, 'right-to-left override'],
  [0x2060, 'word joiner'],
  [0x2061, 'function application'],
  [0x2062, 'invisible times'],
  [0x2063, 'invisible separator'],
  [0x2064, 'invisible plus'],
  [0x2066, 'left-to-right isolate'],
  [0x2067, 'right-to-left isolate'],
  [0x2068, 'first strong isolate'],
  [0x2069, 'pop directional isolate'],
]);

const trackedFiles = listRepositoryFiles();

const rawSpecShingles = loadRawSpecShingles();
const findings = [];

for (const relativePath of trackedFiles) {
  if (ignoredBinaryExtensions.has(path.extname(relativePath).toLowerCase())) {
    continue;
  }

  const buffer = readFileSync(path.join(root, relativePath));
  if (buffer.includes(0)) {
    continue;
  }

  const text = buffer.toString('utf8');
  scanHiddenCharacters(relativePath, text);
  scanForbiddenToken(relativePath, text);
  scanRawSpecLeak(relativePath, text);
}

if (findings.length > 0) {
  console.error('Repository quality scan failed:');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}: ${finding.message}`);
  }
  process.exit(1);
}

console.log('Repository quality scan passed.');

function scanHiddenCharacters(file, text) {
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const character of lines[lineIndex]) {
      const label = hiddenCharacters.get(character.codePointAt(0));
      if (label) {
        findings.push({
          file,
          line: lineIndex + 1,
          message: `non-printing Unicode character detected: ${label}`,
        });
      }
    }
  }
}

function scanForbiddenToken(file, text) {
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex].includes(forbiddenToken)) {
      findings.push({
        file,
        line: lineIndex + 1,
        message: 'forbidden challenge marker token detected',
      });
    }
  }
}

function scanRawSpecLeak(file, text) {
  if (rawSpecShingles.size === 0) {
    return;
  }

  const words = normalizeWords(text);
  for (let index = 0; index <= words.length - 18; index += 1) {
    const shingle = words.slice(index, index + 18).join(' ');
    if (rawSpecShingles.has(shingle)) {
      findings.push({
        file,
        line: estimateLine(text, words[index]),
        message: 'long verbatim fragment from local source specification detected',
      });
      return;
    }
  }
}

function loadRawSpecShingles() {
  const rawText = rawSpecPaths
    .map((relativePath) => path.join(root, relativePath))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => readFileSync(filePath, 'utf8'))
    .join('\n');

  const words = normalizeWords(rawText);
  const shingles = new Set();
  for (let index = 0; index <= words.length - 18; index += 1) {
    shingles.add(words.slice(index, index + 18).join(' '));
  }
  return shingles;
}

function listRepositoryFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
  } catch {
    return walkRepository(root)
      .map((filePath) => path.relative(root, filePath).replaceAll(path.sep, '/'))
      .filter((relativePath) => !rawSpecPaths.includes(relativePath));
  }
}

function walkRepository(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) {
      continue;
    }

    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkRepository(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeWords(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) ?? [];
}

function estimateLine(text, firstWord) {
  const normalizedNeedle = firstWord.toLowerCase();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].toLowerCase().includes(normalizedNeedle)) {
      return index + 1;
    }
  }
  return 1;
}
