import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SlopItem } from '../types.js';
import { HINT_ONLY_CATEGORIES } from '../types.js';
import { CodePreview } from './CodePreview.js';

interface SlopListProps {
  items: SlopItem[];
  baseDir: string;
  onToggle: (id: string) => void;
  onProceed: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMarkNotSlop: (id: string) => void;
}

const SEVERITY_COLORS = {
  low: 'yellow',
  medium: 'magenta',
  high: 'red',
} as const;

export function SlopList({
  items,
  baseDir,
  onToggle,
  onProceed,
  onSelectAll,
  onDeselectAll,
  onMarkNotSlop,
}: SlopListProps) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const visibleItems = 10;

  const selectedCount = items.filter(i => i.selected).length;
  const currentItem = items[cursor];

  useInput((input, key) => {
    if (key.upArrow) {
      const newCursor = Math.max(0, cursor - 1);
      setCursor(newCursor);
      if (newCursor < scrollOffset) {
        setScrollOffset(newCursor);
      }
    } else if (key.downArrow) {
      const newCursor = Math.min(items.length - 1, cursor + 1);
      setCursor(newCursor);
      if (newCursor >= scrollOffset + visibleItems) {
        setScrollOffset(newCursor - visibleItems + 1);
      }
    } else if (input === ' ') {
      const item = items[cursor];
      if (item && !HINT_ONLY_CATEGORIES.includes(item.category)) {
        onToggle(item.id);
      }
    } else if (key.return) {
      if (selectedCount > 0) {
        onProceed();
      }
    } else if (input === 'a') {
      onSelectAll();
    } else if (input === 'n') {
      onDeselectAll();
    } else if (input === 'x') {
      const item = items[cursor];
      if (item) {
        onMarkNotSlop(item.id);
        // Adjust cursor if we removed an item
        if (cursor >= items.length - 1 && cursor > 0) {
          setCursor(cursor - 1);
        }
      }
    }
  });

  const displayItems = items.slice(scrollOffset, scrollOffset + visibleItems);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - Found {items.length} issues
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Arrows: navigate | SPACE: toggle | x: not slop | ENTER: proceed
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          [a] Select all  [n] Deselect all
        </Text>
      </Box>

      <Box flexDirection="row">
        {/* Left side: item list */}
        <Box flexDirection="column" width="50%" borderStyle="single" borderColor="gray">
          {displayItems.map((item, i) => {
            const actualIndex = scrollOffset + i;
            const isSelected = actualIndex === cursor;
            const isHintOnly = HINT_ONLY_CATEGORIES.includes(item.category);

            return (
              <Box key={item.id} paddingX={1}>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {isSelected ? '>' : ' '}
                </Text>
                {isHintOnly ? (
                  <Text dimColor>[--]</Text>
                ) : (
                  <Text color={item.selected ? 'green' : 'gray'}>
                    {item.selected ? '[x]' : '[ ]'}
                  </Text>
                )}
                <Text> </Text>
                <Text color={SEVERITY_COLORS[item.severity]}>
                  [{item.severity.toUpperCase().slice(0, 3)}]
                </Text>
                <Text> </Text>
                {isHintOnly && <Text color="blue">[H] </Text>}
                <Text bold={isSelected} dimColor={isHintOnly} wrap="truncate">
                  {item.title.slice(0, 30)}
                </Text>
              </Box>
            );
          })}

          {items.length > visibleItems && (
            <Box paddingX={1} marginTop={1}>
              <Text dimColor>
                {scrollOffset + 1}-{Math.min(scrollOffset + visibleItems, items.length)} of {items.length}
              </Text>
            </Box>
          )}
        </Box>

        {/* Right side: code preview */}
        <Box flexDirection="column" width="50%" paddingLeft={1}>
          {currentItem && (
            <CodePreview
              baseDir={baseDir}
              file={currentItem.file}
              line={currentItem.line}
              title={currentItem.title}
              category={currentItem.category}
            />
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text>
          Selected: <Text color="green">{selectedCount}</Text> / {items.length}
        </Text>
        <Text>  </Text>
        <Text dimColor>[x] = mark as NOT slop</Text>
      </Box>

      {selectedCount > 0 && (
        <Box marginTop={1}>
          <Text color="green">Press ENTER to proceed with fixes</Text>
        </Box>
      )}
    </Box>
  );
}
