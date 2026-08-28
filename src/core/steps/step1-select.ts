import inquirer from 'inquirer';
import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';
import fs from 'fs/promises';

/**
 * 步骤1：交互式选择输入文件和输出目录
 */
export async function step1Select(context: PipelineContext): Promise<void> {
  const { config } = context;

  // 如果已通过命令行参数指定了输入文件，跳过交互
  if (config.inputPath) {
    logger.info(`输入文件: ${config.inputPath}`);
    if (!config.outputDir) {
      config.outputDir = './output';
    }
    await fs.mkdir(config.outputDir, { recursive: true });
    logger.info(`输出目录: ${config.outputDir}`);
    return;
  }

  logger.info('请选择输入文件:');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputPath',
      message: '请输入 STEP/IGES 文件路径:',
      validate: (input: string) => {
        if (!input) return '请输入文件路径';
        return true;
      },
    },
    {
      type: 'input',
      name: 'outputDir',
      message: '请输入输出目录:',
      default: './output',
      validate: (input: string) => {
        if (!input) return '请输入输出目录';
        return true;
      },
    },
  ]);

  config.inputPath = answers.inputPath;
  config.outputDir = answers.outputDir;

  await fs.mkdir(config.outputDir, { recursive: true });

  logger.info(`输入文件: ${config.inputPath}`);
  logger.info(`输出目录: ${config.outputDir}`);
}
