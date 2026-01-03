import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ReviewSuggestion } from '../types.js';

interface ReviewResultsProps {
  suggestions: ReviewSuggestion[];
  isLoading: boolean;
  onApply: () => void;
  onSkip: () => void;
}

const SEVERITY_COLORS = {
  low: 'yellow',
  medium: 'magenta',
  high: 'red',
} as const;

export function ReviewResults({ suggestions, isLoading, onApply, onSkip }: ReviewResultsProps) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const visibleItems = 8;

  useInput((input, key) => {
    if (isLoading) return;

    if (key.upArrow && suggestions.length > 0) {
      const newCursor = Math.max(0, cursor - 1);
      setCursor(newCursor);
      if (newCursor < scrollOffset) {
        setScrollOffset(newCursor);
      }
    } else if (key.downArrow && suggestions.length > 0) {
      const newCursor = Math.min(suggestions.length - 1, cursor + 1);
      setCursor(newCursor);
      if (newCursor >= scrollOffset + visibleItems) {
        setScrollOffset(newCursor - visibleItems + 1);
      }
    } else if (input === 'a' && suggestions.length > 0) {
      onApply();
    } else if (input === 's' || key.return) {
      if (suggestions.length === 0) {
        onSkip();
      }
    } else if (input === 's') {
      onSkip();
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {'>'} deslop - Reviewing Changes
          </Text>
        </Box>
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Analyzing code changes for improvements...</Text>
        </Box>
      </Box>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="green">
            {'>'} deslop - Review Complete
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="green">Code looks good! No additional improvements suggested.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="green">Press ENTER to finish</Text>
        </Box>
      </Box>
    );
  }

  const displayItems = suggestions.slice(scrollOffset, scrollOffset + visibleItems);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {'>'} deslop - Review Found {suggestions.length} Suggestions
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          The AI review found potential improvements to the applied fixes.
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray">
        {displayItems.map((suggestion, i) => {
          const actualIndex = scrollOffset + i;
          const isSelected = actualIndex === cursor;

          return (
            <Box key={suggestion.id} paddingX={1} flexDirection="column">
              <Box>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? '>' : ' '}
                </Text>
                <Text color={SEVERITY_COLORS[suggestion.severity]}>
                  [{suggestion.severity.toUpperCase()}]
                </Text>
                <Text> </Text>
                <Text bold={isSelected}>{suggestion.title}</Text>
                <Text dimColor> - {suggestion.file}</Text>
                {suggestion.line && <Text dimColor>:{suggestion.line}</Text>}
              </Box>
              {isSelected && suggestion.description && (
                <Box marginLeft={4} marginTop={0}>
                  <Text dimColor wrap="wrap">{suggestion.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {suggestions.length > visibleItems && (
        <Box marginTop={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleItems, suggestions.length)} of {suggestions.length}
          </Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color="green">[a]</Text> Apply suggestions (loop back to fix)
        </Text>
        <Text>
          <Text color="yellow">[s]</Text> Skip and finish
        </Text>
      </Box>
    </Box>
  );
}
