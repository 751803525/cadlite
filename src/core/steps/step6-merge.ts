import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

export async function step6Merge(context: PipelineContext): Promise<void> {
  logger.info('合并输出...');
  logger.warn('step5Merge 尚未实现');
}
