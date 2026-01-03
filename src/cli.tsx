#!/usr/bin/env node

// Suppress unhandled rejection stack traces - errors are handled in React
process.on('unhandledRejection', () => {});

import React, { useState, useCallback } from 'react';
import { render, Box, Text } from 'ink';
import { Command } from 'commander';
import { App } from './App.js';
import { ApiKeyPrompt } from './components/ApiKeyPrompt.js';
import {
  loadConfig,
  loadGlobalConfig,
  createGlobalConfig,
  createProjectConfig,
  GLOBAL_CONFIG_PATH,
  type DeslopsConfig,
} from './config.js';
import { ConfigEditor } from './components/ConfigEditor.js';
import { getApiKey, storeApiKey, deleteApiKey } from './keychain.js';

interface MainProps {
  directory: string;
  config: DeslopsConfig;
  initialApiKey: string | null;
}

function Main({ directory, config, initialApiKey }: MainProps) {
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);

  const handleApiKeySubmit = useCallback(async (key: string) => {
    await storeApiKey(key);
    setApiKey(key);
  }, []);

  if (!apiKey) {
    return <ApiKeyPrompt onSubmit={handleApiKeySubmit} />;
  }

  return <App directory={directory} apiKey={apiKey} config={config} />;
}

function InitSuccess({ path }: { path: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {'>'} deslop - Config Created
        </Text>
      </Box>
      <Text>Created deslop.toml in current directory.</Text>
      <Box marginTop={1}>
        <Text dimColor>Edit {path} to customize models for this project.</Text>
      </Box>
    </Box>
  );
}

function InitError({ message }: { message: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="red">
          {'>'} deslop - Error
        </Text>
      </Box>
      <Text color="red">{message}</Text>
    </Box>
  );
}

function LogoutSuccess() {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {'>'} deslop - Logged Out
        </Text>
      </Box>
      <Text>API key has been removed from secure storage.</Text>
    </Box>
  );
}

function ConfigSaved() {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">
          {'>'} deslop - Config Saved
        </Text>
      </Box>
      <Text>Global model configuration has been updated.</Text>
      <Box marginTop={1}>
        <Text dimColor>Saved to {GLOBAL_CONFIG_PATH}</Text>
      </Box>
    </Box>
  );
}

function ConfigEditorWrapper() {
  const [saved, setSaved] = useState(false);
  const currentConfig = loadGlobalConfig();

  const handleSave = useCallback((newConfig: DeslopsConfig) => {
    createGlobalConfig(newConfig);
    setSaved(true);
  }, []);

  if (saved) {
    return <ConfigSaved />;
  }

  return <ConfigEditor currentConfig={currentConfig} onSave={handleSave} />;
}

const program = new Command();

program
  .name('deslop')
  .description('Remove AI slop from your codebase')
  .version('0.1.1');

program
  .command('init')
  .description('Create project-specific deslop.toml config')
  .action(() => {
    const directory = process.cwd();
    try {
      createProjectConfig(directory);
      render(<InitSuccess path={`${directory}/deslop.toml`} />);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      render(<InitError message={message} />);
    }
  });

program
  .command('logout')
  .description('Remove stored API key from secure storage')
  .action(async () => {
    await deleteApiKey();
    render(<LogoutSuccess />);
  });

program
  .command('config')
  .description('Update global model configuration')
  .action(() => {
    render(<ConfigEditorWrapper />);
  });

program
  .option('-d, --directory <path>', 'Directory to analyze', process.cwd())
  .action(async (options) => {
    const config = loadConfig(options.directory);

    // Priority: env var > keychain > prompt
    let apiKey = process.env.CURSOR_API_KEY || null;
    if (!apiKey) {
      apiKey = await getApiKey();
    }

    render(
      <Main
        directory={options.directory}
        config={config}
        initialApiKey={apiKey}
      />
    );
  });

program.parse();
