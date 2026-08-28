import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

/**
 * 步骤4：逐个对全部网格进行减面
 */
export async function step4Simplify(context: PipelineContext): Promise<void> {
  const count = context.parts.length || 0;
  logger.info(`减面 ${count} 个网格...`);
  logger.warn('step4Simplify 尚未实现');
}
