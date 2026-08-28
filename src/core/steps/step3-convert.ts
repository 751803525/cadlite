import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';

export async function step3Convert(context: PipelineContext): Promise<void> {
  const count = context.parts.length || 0;
  logger.info(`减面 ${count} 个网格...`);
  logger.warn('step3Convert  尚未实现');
}
