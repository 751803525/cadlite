#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { processCommand } from './cli/commands/process.js';
import { initCommand } from './cli/commands/init.js';
import { logger } from './cli/logger.js';
import { tempDir } from './utils/temp-path.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(join(__dirname, '../package.json'), 'utf-8'));

program.name('cadlite').description(pkg.description).version(pkg.version);

process.on;

program
  .command('process')
  .description('工业CAD轻量化流水线（默认仅执行解析，通过 -s 添加更多步骤）')
  .option('-i, --input <path>', '输入 STEP/IGES 文件路径')
  .option('-o, --output <dir>', '输出目录（默认: ./output）')
  .option('-s, --steps <numbers>', '执行步骤: 3,4,5,6（如 -s 3,4），不指定则只执行步骤1+2')
  .option('-m, --mode <mode>', '输出模式: merged | split | both（需要包含步骤6）')
  .option('-f, --target-faces <number>', '目标面数（需要包含步骤4）')
  .option('--keep-temp', '保留临时文件（调试用）')
  .action(async (options) => {
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdtempSync(tempDir);
      }
      logger.info(tempDir);
      await processCommand(options);
      // fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      // fs.rmSync(tempDir, { recursive: true, force: true });
      process.exit(1);
    }
  });

program
  .command('init')
  .description('初始化配置文件')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
