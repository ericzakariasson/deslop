import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync, chmodSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

const SERVICE_NAME = 'deslop';
const ACCOUNT_NAME = 'api-key';
const CREDENTIALS_DIR = join(homedir(), '.deslop');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, '.credentials');

export async function storeApiKey(key: string): Promise<void> {
  const platform = process.platform;

  if (platform === 'darwin') {
    await storeKeyMacOS(key);
  } else if (platform === 'linux') {
    const stored = await storeKeyLinux(key);
    if (!stored) {
      storeKeyFile(key);
    }
  } else {
    // Windows or other - use file fallback
    storeKeyFile(key);
  }
}

export async function getApiKey(): Promise<string | null> {
  const platform = process.platform;

  if (platform === 'darwin') {
    const key = await getKeyMacOS();
    if (key) return key;
  } else if (platform === 'linux') {
    const key = await getKeyLinux();
    if (key) return key;
  }

  // Fallback to file
  return getKeyFile();
}

export async function deleteApiKey(): Promise<void> {
  const platform = process.platform;

  if (platform === 'darwin') {
    await deleteKeyMacOS();
  } else if (platform === 'linux') {
    await deleteKeyLinux();
  }

  // Always try to delete file fallback too
  deleteKeyFile();
}

// macOS Keychain
async function storeKeyMacOS(key: string): Promise<void> {
  // First try to delete any existing entry
  try {
    await execAsync(`security delete-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" 2>/dev/null`);
  } catch {
    // Ignore - may not exist
  }

  await execAsync(`security add-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w "${key}"`);
}

async function getKeyMacOS(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`security find-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function deleteKeyMacOS(): Promise<void> {
  try {
    await execAsync(`security delete-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}"`);
  } catch {
    // Ignore - may not exist
  }
}

// Linux secret-tool
async function storeKeyLinux(key: string): Promise<boolean> {
  try {
    // Check if secret-tool is available
    await execAsync('which secret-tool');

    // Store the key (secret-tool reads from stdin)
    await execAsync(`echo "${key}" | secret-tool store --label="deslop API key" service ${SERVICE_NAME} username ${ACCOUNT_NAME}`);
    return true;
  } catch {
    return false;
  }
}

async function getKeyLinux(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`secret-tool lookup service ${SERVICE_NAME} username ${ACCOUNT_NAME}`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function deleteKeyLinux(): Promise<void> {
  try {
    await execAsync(`secret-tool clear service ${SERVICE_NAME} username ${ACCOUNT_NAME}`);
  } catch {
    // Ignore - may not exist or secret-tool not available
  }
}

// File fallback (with restricted permissions)
function storeKeyFile(key: string): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  // Simple obfuscation (not encryption, but better than plaintext)
  const encoded = Buffer.from(key).toString('base64');
  writeFileSync(CREDENTIALS_FILE, encoded, { mode: 0o600 });

  // Ensure permissions are correct
  chmodSync(CREDENTIALS_FILE, 0o600);
}

function getKeyFile(): string | null {
  try {
    if (!existsSync(CREDENTIALS_FILE)) {
      return null;
    }

    const encoded = readFileSync(CREDENTIALS_FILE, 'utf-8').trim();
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function deleteKeyFile(): void {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      const { unlinkSync } = require('fs');
      unlinkSync(CREDENTIALS_FILE);
    }
  } catch {
    // Ignore
  }
}
