export type AppPhase = 'scanning' | 'results' | 'executing' | 'verifying' | 'reviewing' | 'complete';

export interface SlopItem {
  id: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high';
  category: SlopCategory;
  selected: boolean;
}

export type SlopCategory =
  | 'extra-comments'
  | 'defensive-checks'
  | 'any-cast'
  | 'style-inconsistency'
  | 'generated-docs'
  | 'reinventing-wheel'
  | 'ui-slop';

export const HINT_ONLY_CATEGORIES: SlopCategory[] = ['ui-slop'];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  file?: string;
  slopItemId: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ScanProgress {
  filesScanned: number;
  currentFile: string;
}

export interface ReviewSuggestion {
  id: string;
  title: string;
  description: string;
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high';
}

export interface VerificationCommand {
  id: string;
  name: string;
  command: string;
  type: 'build' | 'test' | 'lint' | 'typecheck';
  optional: boolean;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  output?: string;
  exitCode?: number;
}

export interface VerificationResult {
  command: VerificationCommand;
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

export interface VerificationState {
  commands: VerificationCommand[];
  currentCommandIndex: number;
  attempt: number;
  maxAttempts: number;
  status: 'discovering' | 'running' | 'fixing' | 'passed' | 'failed';
  lastError?: string;
}
