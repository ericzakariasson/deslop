import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import type { DeslopsConfig } from '../config.js';

interface ConfigEditorProps {
  currentConfig: DeslopsConfig;
  onSave: (config: DeslopsConfig) => void;
}

type EditStep = 'menu' | 'planning' | 'executing' | 'verification' | 'custom';

const MODEL_OPTIONS = [
  { id: 'opus-high', name: 'claude-4.5-opus-high', label: 'Opus High (Default - most capable)' },
  { id: 'sonnet-high', name: 'claude-4.5-sonnet-high', label: 'Sonnet High (fast and capable)' },
  { id: 'haiku', name: 'claude-4.5-haiku', label: 'Haiku (fastest, cheapest)' },
  { id: 'custom', name: 'custom', label: 'Custom...' },
];

const MENU_OPTIONS = [
  { id: 'planning', label: 'Planning model' },
  { id: 'executing', label: 'Executing model' },
  { id: 'verification', label: 'Verification model' },
  { id: 'save', label: 'Save and exit' },
];

export function ConfigEditor({ currentConfig, onSave }: ConfigEditorProps) {
  const { exit } = useApp();
  const [step, setStep] = useState<EditStep>('menu');
  const [cursor, setCursor] = useState(0);
  const [config, setConfig] = useState<DeslopsConfig>({ ...currentConfig });
  const [customInput, setCustomInput] = useState('');
  const [editingField, setEditingField] = useState<'planning' | 'executing' | 'verification'>('planning');

  useInput((input, key) => {
    if (step === 'custom') return;

    if (key.escape) {
      if (step === 'menu') {
        exit();
      } else {
        setStep('menu');
        setCursor(0);
      }
      return;
    }

    const options = step === 'menu' ? MENU_OPTIONS : MODEL_OPTIONS;

    if (key.upArrow) {
      setCursor(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCursor(prev => Math.min(options.length - 1, prev + 1));
    } else if (key.tab) {
      setCursor(prev => (prev + 1) % options.length);
    } else if (key.return) {
      if (step === 'menu') {
        const selected = MENU_OPTIONS[cursor];
        if (selected.id === 'save') {
          onSave(config);
        } else {
          setEditingField(selected.id as 'planning' | 'executing' | 'verification');
          setStep(selected.id as EditStep);
          setCursor(0);
        }
      } else {
        const selected = MODEL_OPTIONS[cursor];
        if (selected.id === 'custom') {
          setCustomInput('');
          setStep('custom');
        } else {
          setConfig(prev => ({
            ...prev,
            models: {
              ...prev.models,
              [editingField]: selected.name,
            },
          }));
          setStep('menu');
          setCursor(0);
        }
      }
    }
  });

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    setConfig(prev => ({
      ...prev,
      models: {
        ...prev.models,
        [editingField]: customInput.trim(),
      },
    }));
    setStep('menu');
    setCursor(0);
    setCustomInput('');
  };

  const renderMenu = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Current configuration:</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        <Text>  Planning:     <Text color="cyan">{config.models.planning}</Text></Text>
        <Text>  Executing:    <Text color="cyan">{config.models.executing}</Text></Text>
        <Text>  Verification: <Text color="cyan">{config.models.verification}</Text></Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold>Select a model to change:</Text>
      </Box>
      {MENU_OPTIONS.map((option, i) => (
        <Box key={option.id}>
          <Text color={cursor === i ? 'cyan' : undefined}>
            {cursor === i ? '> ' : '  '}
          </Text>
          <Text bold={cursor === i}>
            {option.id === 'save' ? (
              <Text color="green">{option.label}</Text>
            ) : (
              option.label
            )}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Use arrows to select, ENTER to confirm, ESC to cancel</Text>
      </Box>
    </Box>
  );

  const renderModelSelect = () => {
    const fieldLabels = {
      planning: 'Planning model (for detecting slop)',
      executing: 'Executing model (for applying fixes)',
      verification: 'Verification model (for fixing failures)',
    };

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>{fieldLabels[editingField]}:</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Current: {config.models[editingField]}</Text>
        </Box>
        {MODEL_OPTIONS.map((option, i) => (
          <Box key={option.id}>
            <Text color={cursor === i ? 'cyan' : undefined}>
              {cursor === i ? '> ' : '  '}
            </Text>
            <Text bold={cursor === i}>{option.label}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>Use arrows to select, ENTER to confirm, ESC to go back</Text>
        </Box>
      </Box>
    );
  };

  const renderCustomInput = () => {
    const fieldLabels = {
      planning: 'Planning model',
      executing: 'Executing model',
      verification: 'Verification model',
    };

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Enter custom {fieldLabels[editingField].toLowerCase()}:</Text>
        </Box>
        <Box>
          <Text>Model name: </Text>
          <TextInput
            value={customInput}
            onChange={setCustomInput}
            onSubmit={handleCustomSubmit}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter the model ID and press ENTER</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - Model Configuration
        </Text>
      </Box>

      <Box marginTop={1}>
        {step === 'menu' && renderMenu()}
        {(step === 'planning' || step === 'executing' || step === 'verification') && renderModelSelect()}
        {step === 'custom' && renderCustomInput()}
      </Box>
    </Box>
  );
}
