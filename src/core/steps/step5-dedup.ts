import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

export async function step5Dedup(context: PipelineContext): Promise<void> {
  const count = context.optimizedParts.length || 0;
  logger.info(`去重分析 ${count} 个零件...`);
  logger.warn('step4Dedup 尚未实现');
}
