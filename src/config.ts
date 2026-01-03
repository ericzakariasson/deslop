import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { parse } from '@iarna/toml';
import { join } from 'path';
import { homedir } from 'os';

export interface DeslopsConfig {
  models: {
    planning: string;
    executing: string;
    verification: string;
  };
  verification: {
    maxRetries: number;
    timeout: number;
  };
}

const GLOBAL_CONFIG_DIR = join(homedir(), '.deslop');
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'deslop.toml');

const DEFAULT_CONFIG: DeslopsConfig = {
  models: {
    planning: 'claude-4.5-opus-high',
    executing: 'claude-4.5-opus-high',
    verification: 'claude-4.5-opus-high',
  },
  verification: {
    maxRetries: 3,
    timeout: 300,
  },
};

export function globalConfigExists(): boolean {
  return existsSync(GLOBAL_CONFIG_PATH);
}

export function projectConfigExists(directory: string): boolean {
  return existsSync(join(directory, 'deslop.toml'));
}

function parseConfigFile(configPath: string): DeslopsConfig | null {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = parse(content) as Partial<DeslopsConfig>;
    return {
      models: {
        planning: parsed.models?.planning || DEFAULT_CONFIG.models.planning,
        executing: parsed.models?.executing || DEFAULT_CONFIG.models.executing,
        verification: parsed.models?.verification || DEFAULT_CONFIG.models.verification,
      },
      verification: {
        maxRetries: parsed.verification?.maxRetries ?? DEFAULT_CONFIG.verification.maxRetries,
        timeout: parsed.verification?.timeout ?? DEFAULT_CONFIG.verification.timeout,
      },
    };
  } catch {
    return null;
  }
}

export function loadConfig(directory: string): DeslopsConfig {
  // First, check for project-specific config
  const projectConfigPath = join(directory, 'deslop.toml');
  if (existsSync(projectConfigPath)) {
    const config = parseConfigFile(projectConfigPath);
    if (config) return config;
  }

  // Fall back to global config
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    const config = parseConfigFile(GLOBAL_CONFIG_PATH);
    if (config) return config;
  }

  // Return defaults if neither exists
  return DEFAULT_CONFIG;
}

export function loadGlobalConfig(): DeslopsConfig {
  if (existsSync(GLOBAL_CONFIG_PATH)) {
    const config = parseConfigFile(GLOBAL_CONFIG_PATH);
    if (config) return config;
  }
  return DEFAULT_CONFIG;
}

export function getDefaultConfigContent(config?: DeslopsConfig): string {
  const cfg = config || DEFAULT_CONFIG;
  return `# deslop configuration

[models]
# Model to use for scanning/planning (detecting slop)
planning = "${cfg.models.planning}"

# Model to use for executing fixes
executing = "${cfg.models.executing}"

# Model to use for verification (fixing build/test failures)
verification = "${cfg.models.verification}"

[verification]
# Maximum retry attempts when verification fails
maxRetries = ${cfg.verification.maxRetries}

# Timeout per verification command in seconds
timeout = ${cfg.verification.timeout}
`;
}

export function createGlobalConfig(config: DeslopsConfig): void {
  // Create directory if it doesn't exist
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }

  writeFileSync(GLOBAL_CONFIG_PATH, getDefaultConfigContent(config), 'utf-8');
}

export function createProjectConfig(directory: string): void {
  const configPath = join(directory, 'deslop.toml');

  if (existsSync(configPath)) {
    throw new Error('deslop.toml already exists in this directory');
  }

  // Use global config as base if it exists, otherwise defaults
  const baseConfig = loadConfig(directory);
  writeFileSync(configPath, getDefaultConfigContent(baseConfig), 'utf-8');
}

export { DEFAULT_CONFIG, GLOBAL_CONFIG_PATH };
