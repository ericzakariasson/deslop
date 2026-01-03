import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Task } from '../types.js';

interface TaskRunnerProps {
  tasks: Task[];
  agentOutput: string[];
}

const STATUS_ICONS = {
  pending: '○',
  in_progress: '●',
  completed: '✓',
  failed: '✗',
} as const;

const STATUS_COLORS = {
  pending: 'gray',
  in_progress: 'cyan',
  completed: 'green',
  failed: 'red',
} as const;

export function TaskRunner({ tasks, agentOutput }: TaskRunnerProps) {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const percentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Show all tasks, prioritizing in-progress ones at the top of the visible window
  const windowSize = 10;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const otherTasks = tasks.filter(t => t.status !== 'in_progress');

  // Show in-progress first, then others
  const sortedTasks = [...inProgressTasks, ...otherTasks];
  const visibleTasks = sortedTasks.slice(0, windowSize);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {'>'} deslop - Executing Fixes
          {inProgressCount > 1 && <Text color="yellow"> ({inProgressCount} parallel)</Text>}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Progress: <Text color="green">{completedCount}</Text>
          {failedCount > 0 && <Text color="red"> / {failedCount} failed</Text>}
          <Text> / {tasks.length} tasks ({percentage}%)</Text>
        </Text>
      </Box>

      {/* Progress bar */}
      <Box marginBottom={1}>
        <Text>[</Text>
        {Array.from({ length: 30 }).map((_, i) => {
          const progress = i / 30;
          const completed = progress < completedCount / tasks.length;
          return <Text key={i} color={completed ? 'green' : 'gray'}>{completed ? '█' : '░'}</Text>;
        })}
        <Text>]</Text>
      </Box>

      {/* Task list */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" marginBottom={1}>
        {visibleTasks.map((task) => {
          const isInProgress = task.status === 'in_progress';

          return (
            <Box key={task.id} paddingX={1}>
              <Text color={STATUS_COLORS[task.status]}>
                {task.status === 'in_progress' ? (
                  <Spinner type="dots" />
                ) : (
                  STATUS_ICONS[task.status]
                )}
              </Text>
              <Text> </Text>
              <Text bold={isInProgress} color={isInProgress ? 'cyan' : undefined}>
                {task.title}
              </Text>
              {task.file && (
                <Text dimColor> ({task.file})</Text>
              )}
            </Box>
          );
        })}

        {sortedTasks.length > windowSize && (
          <Box paddingX={1}>
            <Text dimColor>... {sortedTasks.length - windowSize} more</Text>
          </Box>
        )}
      </Box>

      {/* Agent output */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Agent Output:</Text>
        </Box>
        {agentOutput.slice(-6).map((line, i) => (
          <Text key={i} dimColor wrap="truncate-end">{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
