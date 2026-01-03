import React from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { VerificationState } from '../types.js';

interface VerificationRunnerProps {
  state: VerificationState;
  agentOutput: string[];
  onRetry: () => void;
  onSkip: () => void;
  onQuit: () => void;
}

const STATUS_ICONS = {
  pending: '○',
  running: '●',
  passed: '✓',
  failed: '✗',
  skipped: '–',
} as const;

const STATUS_COLORS = {
  pending: 'gray',
  running: 'cyan',
  passed: 'green',
  failed: 'red',
  skipped: 'yellow',
} as const;

export function VerificationRunner({
  state,
  agentOutput,
  onRetry,
  onSkip,
  onQuit,
}: VerificationRunnerProps) {
  const showPrompt = state.status === 'failed';

  useInput((input) => {
    if (!showPrompt) return;
    if (input === 'r') onRetry();
    if (input === 's') onSkip();
    if (input === 'q') onQuit();
  });

  const title = state.status === 'fixing'
    ? 'Fixing Verification Errors'
    : 'Verifying Changes';

  const passedCount = state.commands.filter(c => c.status === 'passed').length;
  const failedCount = state.commands.filter(c => c.status === 'failed').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - {title}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Progress: <Text color="green">{passedCount}</Text>
          {failedCount > 0 && <Text color="red"> / {failedCount} failed</Text>}
          <Text> / {state.commands.length} commands</Text>
          {state.maxAttempts > 1 && (
            <Text> (Attempt <Text color="yellow">{state.attempt}</Text>/{state.maxAttempts})</Text>
          )}
        </Text>
      </Box>

      {/* Command list */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" marginBottom={1}>
        {state.commands.map((cmd) => (
          <Box key={cmd.id} paddingX={1}>
            <Text color={STATUS_COLORS[cmd.status]}>
              {cmd.status === 'running' ? (
                <Spinner type="dots" />
              ) : (
                STATUS_ICONS[cmd.status]
              )}
            </Text>
            <Text> {cmd.command}</Text>
            {cmd.optional && <Text dimColor> (optional)</Text>}
          </Box>
        ))}
      </Box>

      {/* Output */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <Box marginBottom={1}>
          <Text bold>
            {state.status === 'fixing' ? 'Agent Output:' : 'Command Output:'}
          </Text>
        </Box>
        {agentOutput.slice(-8).map((line, i) => (
          <Text key={i} dimColor wrap="truncate-end">{line}</Text>
        ))}
      </Box>

      {showPrompt && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Verification failed after {state.maxAttempts} attempts.</Text>
          <Box marginTop={1}>
            <Text><Text color="green">[r]</Text>etry </Text>
            <Text><Text color="yellow">[s]</Text>kip to review </Text>
            <Text><Text color="red">[q]</Text>uit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
