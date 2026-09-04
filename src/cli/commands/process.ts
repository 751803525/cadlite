import inquirer from 'inquirer';
import { promptStepsSelect } from '../prompts/steps-select.js';
import { logger } from '../logger.js';
import { runPipeline } from '../../core/pipeline/orchestrator.js';
import type { PipelineConfig } from '../../core/types.js';

interface ProcessOptions {
  input?: string;
  output?: string;
  steps?: string;
  mode?: 'merged' | 'split' | 'both';
  targetFaces?: string;
  keepTemp?: boolean;
}

export async function processCommand(options: ProcessOptions): Promise<void> {
  // 1. 处理输入文件路径（参数优先，缺失则交互）
  let inputPath = options.input;
  if (!inputPath) {
    const answer = await inquirer.prompt({
      type: 'input',
      name: 'input',
      message: '请输入 STEP/IGES 文件路径:',
    });
    inputPath = answer.input;
    if (!inputPath) {
      throw new Error('必须提供输入文件路径');
    }
  }

  // 2. 处理输出目录（参数优先，缺失则交互）
  let outputDir = options.output || './output';
  if (!options.output) {
    const answer = await inquirer.prompt({
      type: 'input',
      name: 'output',
      message: '输出目录（默认 ./output）:',
      default: './output',
    });
    outputDir = answer.output;
  }

  // 3. 处理步骤及关联参数
  let steps: number[] = [];
  let mode: 'merged' | 'split' | 'both' = options.mode || 'both';
  let targetFaces = options.targetFaces ? parseInt(options.targetFaces, 10) : 5000;
  let keepTemp = options.keepTemp || false;

  if (options.steps) {
    // 命令行明确指定了步骤
    steps = options.steps.split(',').map(Number) || [];
    // 若命令行未指定 mode/targetFaces/keepTemp，则保留上述默认值
  } else {
    // 未指定步骤 → 进入交互选择（同时获取模式、面数、是否保留临时文件）
    const selection = await promptStepsSelect();
    steps = selection.selectedSteps || [];
    mode = selection.mode;
    targetFaces = selection.targetFaces;
    keepTemp = selection.keepTemp;
  }

  // 4. 命令行显式参数覆盖（优先级最高）
  if (options.mode) mode = options.mode;
  if (options.targetFaces) targetFaces = parseInt(options.targetFaces, 10);
  if (options.keepTemp !== undefined) keepTemp = options.keepTemp;

  // 5. 警告提示（若参数与步骤不匹配）
  if (options.mode && !steps.includes(6)) {
    logger.warn('⚠️ 指定了 --mode 但未包含步骤6，将忽略');
  }
  if (options.targetFaces && !steps.includes(4)) {
    logger.warn('⚠️ 指定了 --target-faces 但未包含步骤4，将忽略');
  }

  // 6. 构建并执行流水线
  const config: PipelineConfig = {
    inputPath,
    outputDir,
    steps,
    mode,
    targetFaces,
    keepTemp,
  };
  await runPipeline(config);
}
