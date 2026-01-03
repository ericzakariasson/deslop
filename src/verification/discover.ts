import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { VerificationCommand } from '../types.js';

export interface DiscoveryResult {
  commands: VerificationCommand[];
  sources: string[];
}

export function discoverVerificationCommands(directory: string): DiscoveryResult {
  const commands: VerificationCommand[] = [];
  const sources: string[] = [];

  // Check package.json (Node.js/JavaScript/TypeScript)
  const packageJsonPath = join(directory, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const scripts = pkg.scripts || {};

      // Priority order: build, typecheck, test, lint
      if (scripts.build) {
        commands.push(createCommand('build', 'npm run build', 'build', false));
      }
      if (scripts.typecheck) {
        commands.push(createCommand('typecheck', 'npm run typecheck', 'typecheck', true));
      } else if (scripts['type-check']) {
        commands.push(createCommand('typecheck', 'npm run type-check', 'typecheck', true));
      }
      if (scripts.test) {
        commands.push(createCommand('test', 'npm run test', 'test', false));
      }
      if (scripts.lint) {
        commands.push(createCommand('lint', 'npm run lint', 'lint', true));
      }

      if (commands.length > 0) {
        sources.push('package.json');
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Check Cargo.toml (Rust)
  const cargoPath = join(directory, 'Cargo.toml');
  if (existsSync(cargoPath) && commands.length === 0) {
    commands.push(createCommand('cargo-build', 'cargo build', 'build', false));
    commands.push(createCommand('cargo-test', 'cargo test', 'test', false));
    commands.push(createCommand('cargo-clippy', 'cargo clippy -- -D warnings', 'lint', true));
    sources.push('Cargo.toml');
  }

  // Check pyproject.toml (Python)
  const pyprojectPath = join(directory, 'pyproject.toml');
  if (existsSync(pyprojectPath) && commands.length === 0) {
    try {
      const content = readFileSync(pyprojectPath, 'utf-8');

      if (content.includes('[tool.pytest]') || content.includes('pytest')) {
        commands.push(createCommand('pytest', 'pytest', 'test', false));
      }
      if (content.includes('[tool.mypy]') || content.includes('mypy')) {
        commands.push(createCommand('mypy', 'mypy .', 'typecheck', true));
      }
      if (content.includes('[tool.ruff]') || content.includes('ruff')) {
        commands.push(createCommand('ruff', 'ruff check .', 'lint', true));
      }

      if (commands.length > 0) {
        sources.push('pyproject.toml');
      }
    } catch {
      // Can't read file, skip
    }
  }

  // Check go.mod (Go)
  const goModPath = join(directory, 'go.mod');
  if (existsSync(goModPath) && commands.length === 0) {
    commands.push(createCommand('go-build', 'go build ./...', 'build', false));
    commands.push(createCommand('go-test', 'go test ./...', 'test', false));
    commands.push(createCommand('go-vet', 'go vet ./...', 'lint', true));
    sources.push('go.mod');
  }

  // Check Makefile (fallback if no other commands found)
  const makefilePath = join(directory, 'Makefile');
  if (existsSync(makefilePath) && commands.length === 0) {
    try {
      const content = readFileSync(makefilePath, 'utf-8');
      const targets = extractMakeTargets(content);

      if (targets.includes('build')) {
        commands.push(createCommand('make-build', 'make build', 'build', false));
      }
      if (targets.includes('test')) {
        commands.push(createCommand('make-test', 'make test', 'test', false));
      }
      if (targets.includes('lint')) {
        commands.push(createCommand('make-lint', 'make lint', 'lint', true));
      }
      if (targets.includes('typecheck') || targets.includes('type-check')) {
        commands.push(createCommand('make-typecheck', `make ${targets.includes('typecheck') ? 'typecheck' : 'type-check'}`, 'typecheck', true));
      }

      if (commands.length > 0) {
        sources.push('Makefile');
      }
    } catch {
      // Can't read file, skip
    }
  }

  return { commands, sources };
}

function createCommand(
  id: string,
  command: string,
  type: VerificationCommand['type'],
  optional: boolean
): VerificationCommand {
  return {
    id,
    name: id.replace(/-/g, ' '),
    command,
    type,
    optional,
    status: 'pending',
  };
}

function extractMakeTargets(content: string): string[] {
  const targetRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*):/gm;
  const targets: string[] = [];
  let match;
  while ((match = targetRegex.exec(content)) !== null) {
    targets.push(match[1]);
  }
  return targets;
}
