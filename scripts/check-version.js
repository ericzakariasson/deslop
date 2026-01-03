#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read package.json
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;
const packageName = packageJson.name;

// Query npm registry to check if version already exists
const registryUrl = `https://registry.npmjs.org/${packageName}`;

try {
  const response = await fetch(registryUrl);
  
  if (!response.ok) {
    if (response.status === 404) {
      // Package doesn't exist yet, which is fine for first publish
      console.log(`✓ Package ${packageName} not found on npm (first publish)`);
      process.exit(0);
    }
    throw new Error(`Failed to query npm registry: ${response.status} ${response.statusText}`);
  }

  const packageData = await response.json();
  const versions = Object.keys(packageData.versions || {});
  
  if (versions.includes(version)) {
    console.error(`❌ Error: Version ${version} already exists on npm.`);
    console.error(`   Existing versions: ${versions.slice(-5).join(', ')}${versions.length > 5 ? '...' : ''}`);
    console.error(`   Update the version in package.json before publishing.`);
    process.exit(1);
  }

  console.log(`✓ Version ${version} is available for publishing`);
  process.exit(0);
} catch (error) {
  console.error(`❌ Error checking npm registry:`, error.message);
  process.exit(1);
}
