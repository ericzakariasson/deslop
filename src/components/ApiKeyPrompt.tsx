import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

interface ApiKeyPromptProps {
  onSubmit: (apiKey: string) => void | Promise<void>;
}

export function ApiKeyPrompt({ onSubmit }: ApiKeyPromptProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (apiKey.trim()) {
      setIsSaving(true);
      await onSubmit(apiKey.trim());
    }
  };

  if (isSaving) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {'>'} deslop - Saving API Key
          </Text>
        </Box>
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Saving to secure storage...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - API Key Required
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          No <Text color="yellow">CURSOR_API_KEY</Text> found.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Get your API key from: https://cursor.com/settings/api
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Your key will be stored securely in the system keychain.
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text>Enter API key: </Text>
        <TextInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleSubmit}
          mask="*"
        />
      </Box>
    </Box>
  );
}
