import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

export async function step7Cleanup(context: PipelineContext): Promise<void> {
  logger.info(`清理临时目录: ${context.tempDir}`);
  logger.warn('step6Cleanup 尚未实现');
}
