import { promptFileSelect } from '../prompts/file-select.js';
import { logger } from '../logger.js';

interface ParseOptions {
  input?: string;
  output?: string;
  interactive?: boolean;
}

export async function parseCommand(options: ParseOptions): Promise<void> {
  logger.info('parse 命令已执行（空壳占位）');

  let inputPath: string;
  let outputDir: string;

  if (options.interactive !== false) {
    const result = await promptFileSelect({
      inputPath: options.input,
      outputDir: options.output,
    });
    inputPath = result.inputPath;
    outputDir = result.outputDir;
  } else {
    if (!options.input) throw new Error('非交互模式必须指定 --input');
    inputPath = options.input;
    outputDir = options.output || './output';
  }

  logger.info(`输入文件: ${inputPath}`);
  logger.info(`输出目录: ${outputDir}`);
}
