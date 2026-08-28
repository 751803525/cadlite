#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== 'production';
const entryFile = isDev
  ? join(__dirname, '../src/index.ts')
  : join(__dirname, '../dist/index.js');

const child = spawn(isDev ? 'tsx' : 'node', [entryFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
});

child.on('exit', (code) => {
  process.exit(code || 0);
});