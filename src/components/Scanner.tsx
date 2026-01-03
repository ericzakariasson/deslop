import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ScanProgress } from '../types.js';

interface ScannerProps {
  progress: ScanProgress;
  messages: string[];
}

export function Scanner({ progress, messages }: ScannerProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - AI Slop Detector
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> Scanning codebase for AI slop...</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          {progress.filesScanned} operations completed
        </Text>
      </Box>

      {progress.currentFile && (
        <Box marginBottom={1}>
          <Text dimColor>Current: {progress.currentFile}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Agent Output:</Text>
        </Box>
        {messages.slice(-8).map((msg, i) => (
          <Text key={i} dimColor>{msg}</Text>
        ))}
      </Box>
    </Box>
  );
}
