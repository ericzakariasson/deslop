import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import { Scanner } from './components/Scanner.js';
import { SlopList } from './components/SlopList.js';
import { TaskRunner } from './components/TaskRunner.js';
import { Complete } from './components/Complete.js';
import { ReviewResults } from './components/ReviewResults.js';
import { VerificationRunner } from './components/VerificationRunner.js';
import { ErrorDisplay, parseError, type ParsedError } from './components/ErrorDisplay.js';
import type { AppPhase, SlopItem, Task, ScanProgress, ReviewSuggestion, VerificationState, VerificationCommand } from './types.js';
import { HINT_ONLY_CATEGORIES } from './types.js';
import type { DeslopsConfig } from './config.js';
import {
  CursorAgent,
  type CursorAgentOptions,
  type InteractionUpdate,
  generateSlopDetectionPrompt,
  generateCodeReviewPrompt,
  generateTasksForSlopItem,
  generateFixPrompt,
  generateVerificationFixPrompt,
} from './agent/cursor-agent.js';
import { discoverVerificationCommands } from './verification/discover.js';
import { runVerificationCommand } from './verification/runner.js';
import {
  createRun,
  getFindingsPath,
  getReviewPath,
  readFindings,
  readReview,
  writeTasks,
  logActivity,
} from './run-manager.js';
import {
  addNotSlopEntry,
  getCodeSnippet,
  getLearningsPromptContext,
} from './learnings.js';

interface AppProps {
  directory: string;
  apiKey: string;
  config: DeslopsConfig;
}

export function App({ directory, apiKey, config }: AppProps) {
  const { exit } = useApp();

  const [phase, setPhase] = useState<AppPhase>('scanning');
  const [slopItems, setSlopItems] = useState<SlopItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scanMessages, setScanMessages] = useState<string[]>([]);
  const [agentOutput, setAgentOutput] = useState<string[]>([]);
  const [error, setError] = useState<ParsedError | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    filesScanned: 0,
    currentFile: '',
  });
  const [reviewSuggestions, setReviewSuggestions] = useState<ReviewSuggestion[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);

  // Buffer for accumulating text deltas into complete lines
  const outputBufferRef = useRef<string>('');
  const scanBufferRef = useRef<string>('');

  // Helper to process text deltas and flush complete lines
  const processTextDelta = useCallback((
    text: string,
    bufferRef: React.MutableRefObject<string>,
    setOutput: React.Dispatch<React.SetStateAction<string[]>>,
    maxLines: number = 10
  ) => {
    bufferRef.current += text;

    // Split on newlines and process
    const lines = bufferRef.current.split('\n');

    if (lines.length > 1) {
      // We have at least one complete line - flush all but the last (incomplete) part
      const completeLines = lines.slice(0, -1).filter(line => line.trim().length > 0);
      bufferRef.current = lines[lines.length - 1];

      if (completeLines.length > 0) {
        setOutput(prev => [...prev.slice(-maxLines), ...completeLines.map(l => l.slice(0, 120))]);
      }
    } else if (bufferRef.current.length > 120) {
      // Buffer is getting long without newlines - flush it as a line
      setOutput(prev => [...prev.slice(-maxLines), bufferRef.current.slice(0, 120)]);
      bufferRef.current = '';
    }
  }, []);

  // Flush remaining buffer content
  const flushBuffer = useCallback((
    bufferRef: React.MutableRefObject<string>,
    setOutput: React.Dispatch<React.SetStateAction<string[]>>,
    maxLines: number = 10
  ) => {
    if (bufferRef.current.trim().length > 0) {
      setOutput(prev => [...prev.slice(-maxLines), bufferRef.current.slice(0, 120)]);
      bufferRef.current = '';
    }
  }, []);

  // Create run ID on mount
  const [runId] = useState(() => createRun(directory));

  // Initialize agents for planning and executing
  const [planningAgent] = useState(() => {
    const options: CursorAgentOptions = {
      apiKey,
      model: config.models.planning,
      workingLocation: {
        type: 'local',
        localDirectory: directory,
      },
    };
    return new CursorAgent(options);
  });

  const [verificationAgent] = useState(() => {
    const options: CursorAgentOptions = {
      apiKey,
      model: config.models.verification,
      workingLocation: {
        type: 'local',
        localDirectory: directory,
      },
    };
    return new CursorAgent(options);
  });

  // Run initial scan
  useEffect(() => {
    let mounted = true;

    async function runScan() {
      logActivity(directory, runId, 'Starting codebase scan');
      setScanMessages(prev => [...prev, 'Starting codebase analysis...']);

      try {
        setScanMessages(prev => [...prev, 'Connecting to Cursor Agent...']);
        setScanProgress({ filesScanned: 0, currentFile: 'Initializing...' });

        const findingsPath = getFindingsPath(directory, runId);
        const learningsContext = getLearningsPromptContext(directory);
        const prompt = generateSlopDetectionPrompt(findingsPath, learningsContext);

        scanBufferRef.current = '';
        const { stream } = planningAgent.submit({
          message: prompt,
          onDelta: ({ update }: { update: InteractionUpdate }) => {
            if (!mounted) return;

            if (update.type === 'text-delta') {
              processTextDelta(update.text, scanBufferRef, setScanMessages, 20);
            } else if (update.type === 'tool-call-started') {
              setScanProgress(prev => ({
                ...prev,
                filesScanned: prev.filesScanned + 1,
                currentFile: `Tool: ${update.toolCall.type}`,
              }));
            }
          },
        });

        for await (const delta of stream) {
          if (!mounted) return;
          // Just consume the stream, agent writes to file
        }
        flushBuffer(scanBufferRef, setScanMessages, 20);

        // Read findings from file
        const items = readFindings(directory, runId);
        logActivity(directory, runId, `Scan complete: found ${items.length} issues`);

        if (items.length > 0) {
          setSlopItems(items);
          setPhase('results');
        } else {
          setScanMessages(prev => [...prev, 'No slop detected in this codebase!']);
          setPhase('complete');
        }
      } catch (err) {
        logActivity(directory, runId, `Scan error: ${err}`);
        setError(parseError(err));
      }
    }

    runScan();

    return () => {
      mounted = false;
    };
  }, [planningAgent, directory, runId]);

  const handleToggle = useCallback((id: string) => {
    setSlopItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSlopItems(prev => prev.map(item => ({ ...item, selected: true })));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSlopItems(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const handleMarkNotSlop = useCallback((id: string) => {
    const item = slopItems.find(i => i.id === id);
    if (item) {
      const codeSnippet = getCodeSnippet(directory, item.file, item.line, 3);
      addNotSlopEntry(directory, item, codeSnippet);
      logActivity(directory, runId, `Marked as not slop: ${item.title} in ${item.file}`);
      setSlopItems(prev => prev.filter(i => i.id !== id));
    }
  }, [slopItems, directory, runId]);

  const handleProceed = useCallback(() => {
    // Filter out hint-only categories - they can't be auto-fixed
    const selectedItems = slopItems.filter(
      item => item.selected && !HINT_ONLY_CATEGORIES.includes(item.category)
    );
    const generatedTasks = selectedItems.flatMap(item => generateTasksForSlopItem(item));
    setTasks(generatedTasks);
    writeTasks(directory, runId, generatedTasks);
    setPhase('executing');

    // Start executing tasks
    executeTasks(generatedTasks, selectedItems);
  }, [slopItems, directory, runId]);

  function groupTasksByFile(taskList: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    for (const task of taskList) {
      const file = task.file || 'unknown';
      if (!groups.has(file)) groups.set(file, []);
      groups.get(file)!.push(task);
    }
    return groups;
  }

  async function executeTask(task: Task, agent: CursorAgent, selectedItems: SlopItem[]) {
    const slopItem = selectedItems.find(s => s.id === task.slopItemId);
    if (!slopItem) return;

    // Mark task as in_progress
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, status: 'in_progress' } : t)
    );
    setAgentOutput(prev => [...prev, `Starting: ${task.title}`]);
    logActivity(directory, runId, `Executing: ${task.title}`);

    try {
      outputBufferRef.current = '';
      const { stream } = agent.submit({
        message: generateFixPrompt(slopItem),
        onDelta: ({ update }: { update: InteractionUpdate }) => {
          if (update.type === 'text-delta') {
            processTextDelta(update.text, outputBufferRef, setAgentOutput);
          }
        },
      });

      for await (const delta of stream) {
        // Deltas are handled in onDelta callback
      }
      flushBuffer(outputBufferRef, setAgentOutput);

      setAgentOutput(prev => [...prev, `Completed: ${task.title}`]);
      logActivity(directory, runId, `Completed: ${task.title}`);
      setTasks(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: 'completed' } : t)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAgentOutput(prev => [...prev, `Failed: ${task.title} - ${message}`]);
      logActivity(directory, runId, `Failed: ${task.title} - ${message}`);
      setTasks(prev =>
        prev.map(t => t.id === task.id ? { ...t, status: 'failed' } : t)
      );
    }
  }

  async function executeTasks(taskList: Task[], selectedItems: SlopItem[]) {
    logActivity(directory, runId, `Starting parallel execution of ${taskList.length} tasks`);

    const fileGroups = groupTasksByFile(taskList);
    logActivity(directory, runId, `Grouped into ${fileGroups.size} file groups`);

    // Execute ALL file groups in parallel
    await Promise.all(
      Array.from(fileGroups.entries()).map(async ([file, fileTasks]) => {
        // Create a fresh agent for this file group
        const agent = new CursorAgent({
          apiKey,
          model: config.models.executing,
          workingLocation: {
            type: 'local',
            localDirectory: directory,
          },
        });

        // Tasks within the same file run sequentially
        for (const task of fileTasks) {
          await executeTask(task, agent, selectedItems);
        }
      })
    );

    // After all tasks, run verification
    runVerification();
  }

  async function runVerification() {
    setPhase('verifying');
    logActivity(directory, runId, 'Starting verification');
    setAgentOutput([]);

    // Discover verification commands
    const discovery = discoverVerificationCommands(directory);

    if (discovery.commands.length === 0) {
      logActivity(directory, runId, 'No verification commands found, skipping to review');
      runReview();
      return;
    }

    logActivity(directory, runId, `Found ${discovery.commands.length} verification commands from ${discovery.sources.join(', ')}`);

    const initialState: VerificationState = {
      commands: discovery.commands,
      currentCommandIndex: 0,
      attempt: 1,
      maxAttempts: config.verification.maxRetries,
      status: 'running',
    };

    setVerificationState(initialState);
    await executeVerification(discovery.commands, 1);
  }

  async function executeVerification(commands: VerificationCommand[], attempt: number) {
    let allPassed = true;
    let failedCommand: VerificationCommand | null = null;
    let failedOutput = '';

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];

      // Update state to show current command running
      setVerificationState(prev => prev ? {
        ...prev,
        currentCommandIndex: i,
        commands: prev.commands.map((c, idx) =>
          idx === i ? { ...c, status: 'running' } : c
        ),
      } : null);

      setAgentOutput(prev => [...prev, `Running: ${cmd.command}`]);

      const result = await runVerificationCommand(cmd, directory, config.verification.timeout);

      // Add output lines
      const outputLines = result.output.split('\n').slice(-10);
      setAgentOutput(prev => [...prev.slice(-5), ...outputLines]);

      if (!result.success && !cmd.optional) {
        allPassed = false;
        failedCommand = { ...cmd, exitCode: result.exitCode, output: result.output };
        failedOutput = result.output;

        setVerificationState(prev => prev ? {
          ...prev,
          commands: prev.commands.map((c, idx) =>
            idx === i ? { ...c, status: 'failed', exitCode: result.exitCode, output: result.output } : c
          ),
        } : null);

        logActivity(directory, runId, `Verification failed: ${cmd.command} (exit code ${result.exitCode})`);
        break;
      }

      // Mark as passed or skipped (for optional failures)
      const newStatus = result.success ? 'passed' : 'skipped';
      setVerificationState(prev => prev ? {
        ...prev,
        commands: prev.commands.map((c, idx) =>
          idx === i ? { ...c, status: newStatus } : c
        ),
      } : null);

      if (result.success) {
        logActivity(directory, runId, `Verification passed: ${cmd.command}`);
      } else {
        logActivity(directory, runId, `Verification skipped (optional): ${cmd.command}`);
      }
    }

    if (allPassed) {
      logActivity(directory, runId, 'All verification commands passed');
      setVerificationState(prev => prev ? { ...prev, status: 'passed' } : null);
      runReview();
      return;
    }

    // Attempt to fix if we have retries left
    if (attempt < config.verification.maxRetries && failedCommand) {
      setVerificationState(prev => prev ? { ...prev, status: 'fixing' } : null);
      setAgentOutput(prev => [...prev, `Attempting to fix verification failure (attempt ${attempt}/${config.verification.maxRetries})...`]);
      logActivity(directory, runId, `Attempting fix for: ${failedCommand.command}`);

      try {
        const fixPrompt = generateVerificationFixPrompt(failedCommand, failedOutput, attempt);

        outputBufferRef.current = '';
        const { stream } = verificationAgent.submit({
          message: fixPrompt,
          onDelta: ({ update }: { update: InteractionUpdate }) => {
            if (update.type === 'text-delta') {
              processTextDelta(update.text, outputBufferRef, setAgentOutput);
            }
          },
        });

        for await (const delta of stream) {
          // Deltas are handled in onDelta callback
        }
        flushBuffer(outputBufferRef, setAgentOutput);

        // Reset commands and retry
        const freshCommands = commands.map(c => ({ ...c, status: 'pending' as const }));
        setVerificationState(prev => prev ? {
          ...prev,
          commands: freshCommands,
          attempt: attempt + 1,
          status: 'running',
        } : null);

        await executeVerification(freshCommands, attempt + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logActivity(directory, runId, `Fix attempt failed: ${message}`);
        setVerificationState(prev => prev ? { ...prev, status: 'failed' } : null);
      }
    } else {
      // Max retries exceeded
      logActivity(directory, runId, `Verification failed after ${attempt} attempts`);
      setVerificationState(prev => prev ? { ...prev, status: 'failed' } : null);
    }
  }

  function handleVerificationRetry() {
    if (!verificationState) return;
    const freshCommands = verificationState.commands.map(c => ({ ...c, status: 'pending' as const }));
    setVerificationState({
      ...verificationState,
      commands: freshCommands,
      attempt: 1,
      status: 'running',
    });
    executeVerification(freshCommands, 1);
  }

  function handleVerificationSkip() {
    logActivity(directory, runId, 'Skipping verification, proceeding to review');
    runReview();
  }

  async function runReview() {
    setPhase('reviewing');
    setIsReviewing(true);
    setReviewSuggestions([]);
    logActivity(directory, runId, 'Starting code review');

    try {
      const reviewPath = getReviewPath(directory, runId);
      const prompt = generateCodeReviewPrompt(reviewPath);

      outputBufferRef.current = '';
      const { stream } = planningAgent.submit({
        message: prompt,
        onDelta: ({ update }: { update: InteractionUpdate }) => {
          if (update.type === 'text-delta') {
            processTextDelta(update.text, outputBufferRef, setAgentOutput);
          }
        },
      });

      for await (const delta of stream) {
        // Just consume the stream, agent writes to file
      }
      flushBuffer(outputBufferRef, setAgentOutput);

      // Read review from file
      const suggestions = readReview(directory, runId);
      setReviewSuggestions(suggestions);
      setIsReviewing(false);
      logActivity(directory, runId, `Review complete: ${suggestions.length} suggestions`);

      if (suggestions.length === 0) {
        // No suggestions, but stay on reviewing phase to show "looks good" message
        // User will press Enter to go to complete
      }
    } catch (err) {
      logActivity(directory, runId, `Review error: ${err}`);
      setError(parseError(err));
    }
  }

  const handleApplySuggestions = useCallback(() => {
    // Convert review suggestions to SlopItems and go back to results
    const newSlopItems: SlopItem[] = reviewSuggestions.map((suggestion, index) => ({
      id: `review-slop-${index}`,
      title: suggestion.title,
      description: suggestion.description,
      file: suggestion.file,
      line: suggestion.line,
      severity: suggestion.severity,
      category: 'style-inconsistency' as const,
      selected: true, // Pre-select all suggestions
    }));

    setSlopItems(newSlopItems);
    setTasks([]);
    setAgentOutput([]);
    setReviewSuggestions([]);
    setPhase('results');
    logActivity(directory, runId, 'Applying review suggestions');
  }, [reviewSuggestions, directory, runId]);

  const handleSkipReview = useCallback(() => {
    setPhase('complete');
    logActivity(directory, runId, 'Run complete');
  }, [directory, runId]);

  if (error) {
    return (
      <ErrorDisplay
        title={error.title}
        message={error.message}
        hint={error.hint}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {phase === 'scanning' && (
        <Scanner progress={scanProgress} messages={scanMessages} />
      )}
      {phase === 'results' && (
        <SlopList
          items={slopItems}
          baseDir={directory}
          onToggle={handleToggle}
          onProceed={handleProceed}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onMarkNotSlop={handleMarkNotSlop}
        />
      )}
      {phase === 'executing' && (
        <TaskRunner
          tasks={tasks}
          agentOutput={agentOutput}
        />
      )}
      {phase === 'verifying' && verificationState && (
        <VerificationRunner
          state={verificationState}
          agentOutput={agentOutput}
          onRetry={handleVerificationRetry}
          onSkip={handleVerificationSkip}
          onQuit={() => exit()}
        />
      )}
      {phase === 'reviewing' && (
        <ReviewResults
          suggestions={reviewSuggestions}
          isLoading={isReviewing}
          onApply={handleApplySuggestions}
          onSkip={handleSkipReview}
        />
      )}
      {phase === 'complete' && (
        <Complete tasks={tasks} baseDir={directory} />
      )}
    </Box>
  );
}
