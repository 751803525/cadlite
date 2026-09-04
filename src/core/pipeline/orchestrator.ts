import type { PipelineConfig, PipelineContext } from '../types.js';
import { selectStep } from '../steps/select-step.js';
import { convertStep } from '../steps/convert-step.js';
import { simplifyGlb } from '../steps/simplify-glb.js';
import { step5Dedup } from '../steps/step5-dedup.js';
import { step6Merge } from '../steps/step6-merge.js';
import { logger } from '../../cli/logger.js';
import { tempDir } from '../../utils/temp-path.js';

const STEP_MAP: Record<number, { name: string; fn: (ctx: PipelineContext) => Promise<void> }> = {
  3: { name: '减面优化', fn: simplifyGlb },
  4: { name: '实例化去重', fn: step5Dedup },
  5: { name: '合并输出', fn: step6Merge },
};

export async function runPipeline(config: PipelineConfig): Promise<PipelineContext> {
  const context: PipelineContext = {
    config,
    tempDir: tempDir,
    mergedPath: '',
    keepTemp: config.keepTemp ?? true,
  };

  // ===== 步骤1：文件选择 =====
  logger.step(1, '选择输入文件...');
  await selectStep(context);
  logger.success('完成');

  // ===== 步骤2：解析 STEP =====
  logger.line();
  logger.step(2, '解析 STEP 文件...');
  const parseTempDir = await convertStep(context);

  console.log(`解析临时目录：${parseTempDir}`);

  if (config.steps?.length > 0) {
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
        throw error;
      }
    }
  } else {
    // ===== 如果用户没有选择任何可选步骤，直接结束 =====
    logger.line();
    logger.info('💡 提示: 使用 -s 3,4,5,6 参数可执行更多处理步骤');
    logger.success('✅ 解析完成！');
    return context;
  }

  logger.line();
  logger.success('🎉 所有任务执行完毕！');

  return context;
}
