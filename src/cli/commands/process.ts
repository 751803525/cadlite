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
  interactive?: boolean;
}

export async function processCommand(options: ProcessOptions): Promise<void> {
  const config: PipelineConfig = {
    inputPath: options.input || '',
    outputDir: options.output || './output',
    steps: [],
    mode: options.mode || 'both',
    targetFaces: options.targetFaces ? parseInt(options.targetFaces, 10) : 5000,
    keepTemp: options.keepTemp || false,
  };

  if (options.interactive !== false) {
    // ===== 交互模式 =====
    // 步骤1+2 在 pipeline 内部处理文件选择
    const selection = await promptStepsSelect();
    config.steps = selection.selectedSteps;
    config.mode = selection.mode;
    config.targetFaces = selection.targetFaces;
    config.keepTemp = selection.keepTemp;
  } else {
    // ===== 非交互模式 =====
    if (!options.input) {
      throw new Error('非交互模式必须指定 --input');
    }
    config.inputPath = options.input;
    config.outputDir = options.output || './output';

    if (options.steps) {
      config.steps = options.steps.split(',').map(Number);
    } else {
      config.steps = [];
    }

    if (options.mode && !config.steps.includes(6)) {
      logger.warn('⚠️ 指定了 --mode 但未包含步骤6，将忽略');
    }
    if (options.targetFaces && !config.steps.includes(4)) {
      logger.warn('⚠️ 指定了 --target-faces 但未包含步骤4，将忽略');
    }
  }

  await runPipeline(config);
}
