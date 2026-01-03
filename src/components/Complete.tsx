import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { spawn } from 'child_process';
import type { Task } from '../types.js';

interface CompleteProps {
  tasks: Task[];
  baseDir: string;
}

type PRStatus = 'prompt' | 'checking' | 'creating' | 'done' | 'error' | 'no-changes' | 'not-git';

export function Complete({ tasks, baseDir }: CompleteProps) {
  const { exit } = useApp();
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;

  const [prStatus, setPrStatus] = useState<PRStatus>('checking');
  const [prUrl, setPrUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check if we're in a git repo with changes
  useEffect(() => {
    async function checkGitStatus() {
      try {
        // Check if it's a git repo
        const isGitRepo = await runCommand('git', ['rev-parse', '--is-inside-work-tree'], baseDir);
        if (!isGitRepo.success) {
          setPrStatus('not-git');
          return;
        }

        // Check if there are any changes
        const diffResult = await runCommand('git', ['diff', '--quiet'], baseDir);
        const diffStagedResult = await runCommand('git', ['diff', '--staged', '--quiet'], baseDir);

        // If both commands succeed (exit 0), there are no changes
        if (diffResult.success && diffStagedResult.success) {
          setPrStatus('no-changes');
          return;
        }

        setPrStatus('prompt');
      } catch {
        setPrStatus('not-git');
      }
    }

    checkGitStatus();
  }, [baseDir]);

  useInput((input, key) => {
    if (prStatus !== 'prompt') return;

    if (input.toLowerCase() === 'y') {
      createPR();
    } else if (input.toLowerCase() === 'n' || key.escape) {
      exit();
    }
  });

  async function createPR() {
    setPrStatus('creating');

    try {
      // Get current branch
      const branchResult = await runCommand('git', ['branch', '--show-current'], baseDir);
      const currentBranch = branchResult.output.trim();

      // Check if we're on main/master
      if (currentBranch === 'main' || currentBranch === 'master') {
        // Create a new branch
        const branchName = `deslop/${Date.now()}`;
        const checkoutResult = await runCommand('git', ['checkout', '-b', branchName], baseDir);
        if (!checkoutResult.success) {
          throw new Error(`Failed to create branch: ${checkoutResult.output}`);
        }
      }

      // Stage all changes
      const addResult = await runCommand('git', ['add', '-A'], baseDir);
      if (!addResult.success) {
        throw new Error(`Failed to stage changes: ${addResult.output}`);
      }

      // Commit changes
      const commitMessage = generateCommitMessage(tasks);
      const commitResult = await runCommand('git', ['commit', '-m', commitMessage], baseDir);
      if (!commitResult.success) {
        throw new Error(`Failed to commit: ${commitResult.output}`);
      }

      // Push to remote
      const pushResult = await runCommand('git', ['push', '-u', 'origin', 'HEAD'], baseDir);
      if (!pushResult.success) {
        throw new Error(`Failed to push: ${pushResult.output}`);
      }

      // Create PR using gh CLI
      const prBody = generatePRBody(tasks);
      const prResult = await runCommand('gh', [
        'pr', 'create',
        '--title', 'chore: deslop codebase',
        '--body', prBody,
      ], baseDir);

      if (!prResult.success) {
        throw new Error(`Failed to create PR: ${prResult.output}`);
      }

      // Extract PR URL from output
      const urlMatch = prResult.output.match(/https:\/\/github\.com\/[^\s]+/);
      if (urlMatch) {
        setPrUrl(urlMatch[0]);
      }

      setPrStatus('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPrStatus('error');
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {'>'} deslop - Complete!
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text>
          <Text color="green">✓</Text> Successfully fixed: <Text bold color="green">{completedCount}</Text> issues
        </Text>
        {failedCount > 0 && (
          <Text>
            <Text color="red">✗</Text> Failed: <Text bold color="red">{failedCount}</Text> issues
          </Text>
        )}
      </Box>

      {failedCount > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="red" padding={1}>
          <Text bold color="red">Failed Tasks:</Text>
          {tasks.filter(t => t.status === 'failed').map(task => (
            <Text key={task.id} dimColor>- {task.title}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {prStatus === 'checking' && (
          <Text dimColor>Checking git status...</Text>
        )}

        {prStatus === 'not-git' && (
          <Text dimColor>
            Not a git repository. Run `git diff` to review changes.
          </Text>
        )}

        {prStatus === 'no-changes' && (
          <Text dimColor>
            No changes detected. Your codebase is already clean!
          </Text>
        )}

        {prStatus === 'prompt' && (
          <Box flexDirection="column">
            <Text dimColor>
              Your codebase has been deslopped. Run `git diff` to review changes.
            </Text>
            <Box marginTop={1}>
              <Text>Create a pull request? </Text>
              <Text bold color="cyan">[y/n]</Text>
            </Box>
          </Box>
        )}

        {prStatus === 'creating' && (
          <Text color="yellow">Creating pull request...</Text>
        )}

        {prStatus === 'done' && (
          <Box flexDirection="column">
            <Text color="green">✓ Pull request created!</Text>
            {prUrl && <Text dimColor>{prUrl}</Text>}
          </Box>
        )}

        {prStatus === 'error' && (
          <Box flexDirection="column">
            <Text color="red">✗ Failed to create PR</Text>
            <Text dimColor>{errorMessage}</Text>
            <Box marginTop={1}>
              <Text dimColor>You can manually create a PR with your changes.</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on('error', () => {
      resolve({ success: false, output: `Command not found: ${cmd}` });
    });
  });
}

function generateCommitMessage(tasks: Task[]): string {
  const completed = tasks.filter(t => t.status === 'completed');
  const categories = [...new Set(completed.map(t => t.title.split(':')[0]))];

  if (categories.length === 1) {
    return `chore: deslop - ${categories[0].toLowerCase()}`;
  }

  return `chore: deslop codebase

Fixed ${completed.length} issues:
${completed.slice(0, 10).map(t => `- ${t.title}`).join('\n')}${completed.length > 10 ? `\n... and ${completed.length - 10} more` : ''}`;
}

function generatePRBody(tasks: Task[]): string {
  const completed = tasks.filter(t => t.status === 'completed');
  const failed = tasks.filter(t => t.status === 'failed');

  let body = `## Summary

Automated cleanup of codebase issues using [deslop](https://github.com/anthropics/deslop).

### Fixed (${completed.length})

${completed.map(t => `- ${t.title}`).join('\n')}`;

  if (failed.length > 0) {
    body += `

### Failed (${failed.length})

${failed.map(t => `- ${t.title}`).join('\n')}`;
  }

  body += `

---
*Generated by deslop*`;

  return body;
}
