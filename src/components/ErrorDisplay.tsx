import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';

interface ErrorDisplayProps {
  title: string;
  message: string;
  hint?: string;
}

export function ErrorDisplay({ title, message, hint }: ErrorDisplayProps) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.return || input === 'q') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="red">
          {'>'} deslop - {title}
        </Text>
      </Box>

      <Box marginBottom={1} borderStyle="single" borderColor="red" paddingX={2} paddingY={1}>
        <Text>{message}</Text>
      </Box>

      {hint && (
        <Box marginBottom={1}>
          <Text dimColor>{hint}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press ENTER or 'q' to exit</Text>
      </Box>
    </Box>
  );
}

export interface ParsedError {
  title: string;
  message: string;
  hint?: string;
}

export function parseError(err: unknown): ParsedError {
  const rawMessage = err instanceof Error ? err.message : String(err);

  // Invalid API key
  if (rawMessage.includes('Invalid API key')) {
    return {
      title: 'Invalid API Key',
      message: 'The provided Cursor API key is invalid.',
      hint: 'Get your API key from: https://cursor.com/settings/api\nSet it with: export CURSOR_API_KEY=your_key_here',
    };
  }

  // Connection/network errors
  if (rawMessage.includes('ENOTFOUND') || rawMessage.includes('ECONNREFUSED')) {
    return {
      title: 'Connection Failed',
      message: 'Could not connect to the Cursor API.',
      hint: 'Check your internet connection and try again.',
    };
  }

  // Timeout errors
  if (rawMessage.includes('timeout') || rawMessage.includes('ETIMEDOUT')) {
    return {
      title: 'Request Timeout',
      message: 'The request to the Cursor API timed out.',
      hint: 'Try again later or check your connection.',
    };
  }

  // Rate limit
  if (rawMessage.includes('rate limit') || rawMessage.includes('429')) {
    return {
      title: 'Rate Limited',
      message: 'Too many requests. Please wait before trying again.',
      hint: 'Wait a few minutes and try again.',
    };
  }

  // Model not found/invalid
  if (rawMessage.toLowerCase().includes('model') &&
      (rawMessage.includes('not found') || rawMessage.includes('not valid') || rawMessage.includes('invalid'))) {
    // Extract the model name if present
    const modelMatch = rawMessage.match(/"([^"]+)"/);
    const modelName = modelMatch ? modelMatch[1] : 'unknown';
    return {
      title: 'Invalid Model',
      message: `Model "${modelName}" is not valid.`,
      hint: 'Check your ~/.deslop/deslop.toml or project deslop.toml for valid model names.\nValid models: sonnet-4.5, opus-4.5, haiku-4.5, opus-4.1, gpt-5.1, gpt-5.2',
    };
  }

  // Generic fallback - clean up common noise
  let cleanMessage = rawMessage
    .replace(/\[unknown\]\s*/gi, '')
    .replace(/ConnectError:\s*/gi, '')
    .trim();

  return {
    title: 'Error',
    message: cleanMessage || 'An unknown error occurred.',
  };
}
