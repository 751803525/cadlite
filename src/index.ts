#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseCommand } from './cli/commands/parse.js';
import { runCommand } from './cli/commands/run.js';
import { initCommand } from './cli/commands/init.js';
import { logger } from './cli/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

program.name('cadlite').description(pkg.description).version(pkg.version);

program
  .command('parse')
  .description('仅执行步骤1+2：解析STEP，提取关系JSON')
  .option('-i, --input <path>', '输入 STEP/IGES 文件路径')
  .option('-o, --output <dir>', '输出目录')
  .option('--no-interactive', '禁用交互式提示')
  .action(async (options) => {
    try {
      await parseCommand(options);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('主流程：解析 + 可选功能模块 (3,4,5,6)')
  .option('-i, --input <path>', '输入 STEP/IGES 文件路径')
  .option('-o, --output <dir>', '输出目录')
  .option('-s, --steps <numbers>', '执行步骤: 3,4,5,6 (如 --steps 3,4)')
  .option('-m, --mode <mode>', '输出模式: merged|split|both')
  .option('-f, --target-faces <number>', '目标面数')
  .option('--keep-temp', '保留临时文件')
  .option('--no-interactive', '禁用交互式提示')
  .action(async (options) => {
    try {
      await runCommand(options);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
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

try {
  await program.parseAsync(process.argv);
} catch (error) {
  logger.error(error);
  process.exit(1);
}
