import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { SlopItem, Task, ReviewSuggestion, SlopCategory, VerificationResult } from './types.js';

const RUNS_DIR = '.deslop/runs';

export function createRun(baseDir: string): string {
  const now = new Date();
  const runId = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);

  const runDir = join(baseDir, RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });

  return runId;
}

export function getRunDir(baseDir: string, runId: string): string {
  return join(baseDir, RUNS_DIR, runId);
}

export function getFindingsPath(baseDir: string, runId: string): string {
  return join(getRunDir(baseDir, runId), 'findings.md');
}

export function getReviewPath(baseDir: string, runId: string): string {
  return join(getRunDir(baseDir, runId), 'review.md');
}

export function getVerificationPath(baseDir: string, runId: string): string {
  return join(getRunDir(baseDir, runId), 'verification.md');
}

export function writeVerificationResults(
  baseDir: string,
  runId: string,
  results: VerificationResult[],
  attempt: number
): void {
  const verificationPath = getVerificationPath(baseDir, runId);

  let content = `# Verification Results\nRun: ${runId}\nAttempt: ${attempt}\n\n`;

  for (const result of results) {
    content += `## ${result.command.name}\n`;
    content += `- **Command:** ${result.command.command}\n`;
    content += `- **Status:** ${result.success ? 'PASSED' : 'FAILED'}\n`;
    content += `- **Exit Code:** ${result.exitCode}\n`;
    content += `- **Duration:** ${result.duration}ms\n\n`;
    content += `### Output\n\`\`\`\n${result.output}\n\`\`\`\n\n`;
  }

  writeFileSync(verificationPath, content, 'utf-8');
}

export function readFindings(baseDir: string, runId: string): SlopItem[] {
  const findingsPath = getFindingsPath(baseDir, runId);

  if (!existsSync(findingsPath)) {
    return [];
  }

  const content = readFileSync(findingsPath, 'utf-8');
  return parseFindingsMarkdown(content);
}

export function readReview(baseDir: string, runId: string): ReviewSuggestion[] {
  const reviewPath = getReviewPath(baseDir, runId);

  if (!existsSync(reviewPath)) {
    return [];
  }

  const content = readFileSync(reviewPath, 'utf-8');
  return parseReviewMarkdown(content);
}

export function writeTasks(baseDir: string, runId: string, tasks: Task[]): void {
  const tasksPath = join(getRunDir(baseDir, runId), 'tasks.md');

  let content = `# Deslop Tasks\nRun: ${runId}\n\n## Tasks to Execute\n\n`;

  tasks.forEach((task, i) => {
    content += `### ${i + 1}. ${task.title}\n`;
    content += `- **ID:** ${task.id}\n`;
    content += `- **Status:** ${task.status}\n`;
    if (task.file) content += `- **File:** ${task.file}\n`;
    content += `- **Description:** ${task.description}\n\n`;
  });

  writeFileSync(tasksPath, content, 'utf-8');
}

export function logActivity(baseDir: string, runId: string, message: string): void {
  const logPath = join(getRunDir(baseDir, runId), 'log.md');
  const timestamp = new Date().toISOString();

  let content = '';
  if (existsSync(logPath)) {
    content = readFileSync(logPath, 'utf-8');
  } else {
    content = `# Deslop Activity Log\nRun: ${runId}\n\n`;
  }

  content += `- [${timestamp}] ${message}\n`;
  writeFileSync(logPath, content, 'utf-8');
}

// --- Markdown Parsers ---

function parseFindingsMarkdown(content: string): SlopItem[] {
  const items: SlopItem[] = [];

  // Match issue blocks: ### N. [SEVERITY] Title
  const issueRegex = /### \d+\. \[(\w+)\] (.+)\n([\s\S]*?)(?=### \d+\.|## |$)/g;
  let match;
  let index = 0;

  while ((match = issueRegex.exec(content)) !== null) {
    const severity = match[1].toLowerCase() as 'low' | 'medium' | 'high';
    const title = match[2].trim();
    const body = match[3];

    const file = extractField(body, 'File') || 'unknown';
    const line = parseInt(extractField(body, 'Line') || '0', 10) || undefined;
    const category = (extractField(body, 'Category') || 'style-inconsistency') as SlopCategory;
    const description = extractField(body, 'Description') || '';

    items.push({
      id: `slop-${index++}`,
      title,
      description,
      file,
      line,
      severity,
      category,
      selected: false,
    });
  }

  return items;
}

function parseReviewMarkdown(content: string): ReviewSuggestion[] {
  const suggestions: ReviewSuggestion[] = [];

  // Check for NO_SUGGESTIONS marker
  if (content.includes('No suggestions') || content.includes('NO_SUGGESTIONS') || content.includes('looks good')) {
    return [];
  }

  // Match suggestion blocks: ### N. [SEVERITY] Title
  const suggestionRegex = /### \d+\. \[(\w+)\] (.+)\n([\s\S]*?)(?=### \d+\.|## |$)/g;
  let match;
  let index = 0;

  while ((match = suggestionRegex.exec(content)) !== null) {
    const severity = match[1].toLowerCase() as 'low' | 'medium' | 'high';
    const title = match[2].trim();
    const body = match[3];

    const file = extractField(body, 'File') || 'unknown';
    const line = parseInt(extractField(body, 'Line') || '0', 10) || undefined;
    const description = extractField(body, 'Description') || '';

    suggestions.push({
      id: `review-${index++}`,
      title,
      file,
      line,
      severity,
      description,
    });
  }

  return suggestions;
}

function extractField(text: string, field: string): string | null {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}
