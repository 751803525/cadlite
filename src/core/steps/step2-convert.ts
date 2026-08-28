import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

export async function step2Convert(context: PipelineContext): Promise<void> {
  const count = context.hierarchy?.parts.length || 0;
  logger.info(`转换 ${count} 个零件...`);
  logger.warn('step2Convert 尚未实现');
}
