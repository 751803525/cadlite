import type { PipelineConfig, PipelineContext } from '../types.js';
import { step1Parse } from '../steps//step1-parse.js';
import { step2Convert } from '../steps/step2-convert.js';
import { step3Simplify } from '../steps/step3-simplify.js';
import { step4Dedup } from '../steps/step4-dedup.js';
import { step5Merge } from '../steps/step5-merge.js';
import { step6Cleanup } from '../steps/step6-cleanup.js';
import { logger } from '../../cli/logger.js';

const STEP_MAP: Record<number, { name: string; fn: (ctx: PipelineContext) => Promise<void> }> = {
  3: { name: '转换零件 → GLB', fn: step2Convert },
  4: { name: '减面优化', fn: step3Simplify },
  5: { name: '实例化去重', fn: step4Dedup },
  6: { name: '合并输出', fn: step5Merge },
};

export async function runPipeline(config: PipelineConfig): Promise<PipelineContext> {
  const context: PipelineContext = {
    config,
    tempDir: `${config.outputDir}/.cadlite-temp`,
    hierarchy: null,
    parts: [],
    optimizedParts: [],
    dedupMap: null,
    mergedPath: '',
  };

  logger.step(1, 1, '解析 STEP 文件...');
  await step1Parse(context);
  logger.success(`完成，找到 ${context.hierarchy?.parts.length || 0} 个零件`);

  const stepsToRun = config.steps.sort((a, b) => a - b);

  for (const stepNum of stepsToRun) {
    const step = STEP_MAP[stepNum];
    if (!step) {
      logger.warn(`未知步骤: ${stepNum}，已跳过`);
      continue;
    }

    logger.line();
    logger.step(stepNum, 6, step.name);

    try {
      await step.fn(context);
      logger.success('完成');
    } catch (error) {
      logger.error('失败:', error);
      await step6Cleanup(context);
      throw error;
    }
  }

  if (!config.keepTemp) {
    await step6Cleanup(context);
  }

  logger.line();
  logger.success('🎉 所有任务执行完毕！');

  return context;
}
