import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { SlopItem } from './types.js';

const LEARNINGS_DIR = '.deslop/learnings';
const NOT_SLOP_FILE = 'not-slop.md';

export interface NotSlopEntry {
  file: string;
  line?: number;
  category: string;
  title: string;
  codeSnippet: string;
  timestamp: string;
}

function getLearningsDir(baseDir: string): string {
  return join(baseDir, LEARNINGS_DIR);
}

function getNotSlopPath(baseDir: string): string {
  return join(getLearningsDir(baseDir), NOT_SLOP_FILE);
}

function ensureLearningsDir(baseDir: string): void {
  const dir = getLearningsDir(baseDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadNotSlopEntries(baseDir: string): NotSlopEntry[] {
  const filePath = getNotSlopPath(baseDir);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseNotSlopMarkdown(content);
}

export function addNotSlopEntry(baseDir: string, item: SlopItem, codeSnippet: string): void {
  ensureLearningsDir(baseDir);

  const entry: NotSlopEntry = {
    file: item.file,
    line: item.line,
    category: item.category,
    title: item.title,
    codeSnippet,
    timestamp: new Date().toISOString().slice(0, 10),
  };

  const filePath = getNotSlopPath(baseDir);
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = `# Deslop Learnings - Not Slop

These patterns were flagged but the user marked them as NOT slop.
This context is included in future scans to avoid similar false positives.

`;
  }

  // Count existing entries to get next number
  const entryCount = (content.match(/## Entry \d+/g) || []).length;
  const entryNumber = entryCount + 1;

  // Append new entry
  content += `## Entry ${entryNumber}
- **File:** ${entry.file}
${entry.line ? `- **Line:** ${entry.line}` : ''}
- **Category:** ${entry.category}
- **Original title:** ${entry.title}
- **Code snippet:**
\`\`\`
${entry.codeSnippet}
\`\`\`
- **Marked as not slop on:** ${entry.timestamp}

`;

  writeFileSync(filePath, content, 'utf-8');
}

export function getLearningsPromptContext(baseDir: string): string {
  const entries = loadNotSlopEntries(baseDir);

  if (entries.length === 0) {
    return '';
  }

  let context = `
IMPORTANT: The user has previously marked these patterns as NOT slop. Do NOT flag similar patterns:

`;

  entries.forEach((entry, i) => {
    context += `${i + 1}. In ${entry.file}${entry.line ? `:${entry.line}` : ''} (${entry.category}):
   "${entry.title}" was marked as acceptable.
   Code: ${entry.codeSnippet.slice(0, 100)}${entry.codeSnippet.length > 100 ? '...' : ''}

`;
  });

  context += `Avoid flagging similar patterns to the above.\n`;

  return context;
}

function parseNotSlopMarkdown(content: string): NotSlopEntry[] {
  const entries: NotSlopEntry[] = [];

  // Match entry blocks
  const entryRegex = /## Entry \d+\n([\s\S]*?)(?=## Entry \d+|$)/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    const body = match[1];

    const file = extractField(body, 'File') || 'unknown';
    const line = parseInt(extractField(body, 'Line') || '0', 10) || undefined;
    const category = extractField(body, 'Category') || 'unknown';
    const title = extractField(body, 'Original title') || 'unknown';
    const timestamp = extractField(body, 'Marked as not slop on') || '';

    // Extract code snippet
    const codeMatch = body.match(/```[\s\S]*?\n([\s\S]*?)```/);
    const codeSnippet = codeMatch ? codeMatch[1].trim() : '';

    entries.push({
      file,
      line,
      category,
      title,
      codeSnippet,
      timestamp,
    });
  }

  return entries;
}

function extractField(text: string, field: string): string | null {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function getCodeSnippet(baseDir: string, filePath: string, line?: number, contextLines: number = 3): string {
  const fullPath = join(baseDir, filePath);

  if (!existsSync(fullPath)) {
    return '(File not found)';
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    if (!line || line < 1) {
      // Return first few lines if no line specified
      return lines.slice(0, contextLines * 2 + 1).join('\n');
    }

    const startLine = Math.max(0, line - 1 - contextLines);
    const endLine = Math.min(lines.length, line + contextLines);

    return lines.slice(startLine, endLine).join('\n');
  } catch {
    return '(Error reading file)';
  }
}
