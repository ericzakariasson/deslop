import React from 'react';
import { Box, Text } from 'ink';
import { getCodeSnippet } from '../learnings.js';

interface CodePreviewProps {
  baseDir: string;
  file: string;
  line?: number;
  title: string;
  category: string;
}

export function CodePreview({ baseDir, file, line, title, category }: CodePreviewProps) {
  const snippet = getCodeSnippet(baseDir, file, line, 5);
  const lines = snippet.split('\n');

  // Calculate line numbers for display
  const startLine = line ? Math.max(1, line - 5) : 1;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">{file}</Text>
        {line && <Text dimColor>:{line}</Text>}
      </Box>

      <Box marginBottom={1}>
        <Text wrap="truncate">
          <Text color="yellow">[{category}]</Text>
          <Text> {title}</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>{'─'.repeat(40)}</Text>
        {lines.map((lineContent, i) => {
          const lineNum = startLine + i;
          const isTargetLine = line && lineNum === line;

          return (
            <Box key={i}>
              <Text color={isTargetLine ? 'yellow' : 'gray'}>
                {isTargetLine ? '>' : ' '}
              </Text>
              <Text dimColor>
                {String(lineNum).padStart(4, ' ')} │
              </Text>
              <Text color={isTargetLine ? 'white' : undefined} dimColor={!isTargetLine}>
                {lineContent}
              </Text>
            </Box>
          );
        })}
        <Text dimColor>{'─'.repeat(40)}</Text>
      </Box>

      {snippet === '(File not found)' && (
        <Box marginTop={1}>
          <Text color="red">File not found</Text>
        </Box>
      )}

      {snippet === '(Error reading file)' && (
        <Box marginTop={1}>
          <Text color="red">Error reading file</Text>
        </Box>
      )}
    </Box>
  );
}
