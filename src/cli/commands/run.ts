import { promptFileSelect } from '../prompts/file-select.js';
import { promptStepsSelect } from '../prompts/steps-select.js';
import { logger } from '../logger.js';

interface RunOptions {
  input?: string;
  output?: string;
  steps?: string;
  mode?: 'merged' | 'split' | 'both';
  targetFaces?: string;
  keepTemp?: boolean;
  interactive?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  logger.info('run 命令已执行（空壳占位）');

  let config: any;

  if (options.interactive !== false) {
    // 步骤1：选择文件
    const { inputPath, outputDir } = await promptFileSelect({
      inputPath: options.input,
      outputDir: options.output,
    });

    logger.success(`输入文件: ${inputPath}`);
    logger.success(`输出目录: ${outputDir}`);
    logger.warn('步骤1+2 (解析) 尚未实现');

    // 步骤2：选择功能模块
    const selection = await promptStepsSelect();
    logger.info(`选中步骤: ${selection.selectedSteps.join(', ')}`);
    logger.info(`输出模式: ${selection.mode}`);
    logger.info(`目标面数: ${selection.targetFaces}`);

    config = { inputPath, outputDir, ...selection };
  } else {
    if (!options.input) throw new Error('非交互模式必须指定 --input');
    if (!options.steps) throw new Error('非交互模式必须指定 --steps');

    config = {
      inputPath: options.input,
      outputDir: options.output || './output',
      steps: options.steps.split(',').map(Number),
      mode: options.mode || 'both',
      targetFaces: options.targetFaces ? parseInt(options.targetFaces, 10) : 5000,
      keepTemp: options.keepTemp || false,
    };
  }

  logger.warn('run 流水线尚未实现具体功能');
}
