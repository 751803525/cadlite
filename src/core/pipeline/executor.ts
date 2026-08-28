import type { PipelineContext } from '../types.js';

export async function executeStep(_context: PipelineContext, _stepName: string): Promise<void> {
  throw new Error('executeStep: 未实现');
}
