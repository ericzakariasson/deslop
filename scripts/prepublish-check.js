#!/usr/bin/env node

import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('Running pre-publish checks...\n');

// Check if dist directory exists
const distDir = join(rootDir, 'dist');
if (!existsSync(distDir)) {
  console.error('❌ Error: dist directory does not exist.');
  console.error('   Run "npm run build" before publishing.');
  process.exit(1);
}

// Check if dist/cli.js exists
const distCliPath = join(distDir, 'cli.js');
if (!existsSync(distCliPath)) {
  console.error('❌ Error: dist/cli.js does not exist.');
  console.error('   Run "npm run build" before publishing.');
  process.exit(1);
}

console.log('✓ dist directory exists');
console.log('✓ dist/cli.js exists');

// Run npm pkg fix to fix package.json issues automatically
try {
  console.log('\nRunning npm pkg fix...');
  execFileSync('npm', ['pkg', 'fix'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  console.log('✓ package.json validated and fixed');
} catch (error) {
  console.error('❌ Error running npm pkg fix:', error.message);
  process.exit(1);
}

console.log('\n✓ All pre-publish checks passed');
process.exit(0);
