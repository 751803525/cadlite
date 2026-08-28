import type { PipelineConfig, PipelineContext } from '../types.js';
import { step1Select } from '../steps/step1-select.js';
import { step2Parse } from '../steps/step2-parse.js';
import { step3Convert } from '../steps/step3-convert.js';
import { step4Simplify } from '../steps/step4-simplify.js';
import { step5Dedup } from '../steps/step5-dedup.js';
import { step6Merge } from '../steps/step6-merge.js';
import { step7Cleanup } from '../steps/step7-cleanup.js';
import { logger } from '../../cli/logger.js';

const STEP_MAP: Record<number, { name: string; fn: (ctx: PipelineContext) => Promise<void> }> = {
  3: { name: '转换零件 → GLB', fn: step3Convert },
  4: { name: '减面优化', fn: step4Simplify },
  5: { name: '实例化去重', fn: step5Dedup },
  6: { name: '合并输出', fn: step6Merge },
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

  // ===== 步骤1：文件选择 =====
  logger.step(1, '选择输入文件...');
  await step1Select(context);
  logger.success('完成');

  // ===== 步骤2：解析 STEP =====
  logger.line();
  logger.step(2, '解析 STEP 文件...');
  await step2Parse(context);
  logger.success(`完成，找到 ${context.hierarchy?.parts.length || 0} 个零件`);

  // ===== 如果用户没有选择任何可选步骤，直接结束 =====
  if (config.steps.length === 0) {
    logger.line();
    logger.info('💡 提示: 使用 -s 3,4,5,6 参数可执行更多处理步骤');
    logger.success('✅ 解析完成！');
    return context;
  }

  // ===== 可选步骤：3-6 =====
  const stepsToRun = config.steps.sort((a, b) => a - b);

  for (const stepNum of stepsToRun) {
    const step = STEP_MAP[stepNum];
    if (!step) {
      logger.warn(`未知步骤: ${stepNum}，已跳过`);
      continue;
    }

    logger.line();
    logger.step(stepNum, step.name);

    try {
      await step.fn(context);
      logger.success('完成');
    } catch (error) {
      logger.error('失败:', error);
      await step7Cleanup(context);
      throw error;
    }
  }

  // ===== 清理 =====
  if (!config.keepTemp) {
    await step7Cleanup(context);
  }

  logger.line();
  logger.success('🎉 所有任务执行完毕！');

  return context;
}
