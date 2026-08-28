import { promptConvert } from "../prompts.js";
import { logger } from "../logger.js";
import { runPipeline } from "../../core/pipeline/orchestrator.js";
import { PipelineConfig } from "../../core/types.js";

interface ConvertOptions {
  input?: string;
  output?: string;
  mode?: "merged" | "split" | "both";
  targetFaces?: string;
  keepTemp?: boolean;
  interactive?: boolean;
}

export async function convertCommand(options: ConvertOptions) {
  const config: PipelineConfig = {
    inputPath: "",
    outputDir: "",
    mode: "both",
    targetFaces: 5000,
    keepTemp: false,
  };

  if (options.interactive !== false) {
    // 交互模式
    const answers = await promptConvert({
      inputPath: options.input,
      outputDir: options.output,
      mode: options.mode,
      targetFaces: options.targetFaces
        ? parseInt(options.targetFaces, 10)
        : 5000,
      keepTemp: options.keepTemp,
    });
    Object.assign(config, answers);
  } else {
    // 非交互模式（纯CLI）
    if (!options.input) {
      throw new Error("非交互模式下必须指定 --input");
    }
    config.inputPath = options.input;
    config.outputDir = options.output || "./output";
    config.mode = options.mode || "both";
    config.targetFaces = options.targetFaces
      ? parseInt(options.targetFaces, 10)
      : 5000;
    config.keepTemp = options.keepTemp || false;
  }

  logger.line();
  logger.info(`输入文件: ${config.inputPath}`);
  logger.info(`输出目录: ${config.outputDir}`);
  logger.info(`输出模式: ${config.mode}`);
  logger.info(`目标面数: ${config.targetFaces}`);
  logger.line();

  // 执行流水线
  const result = await runPipeline(config);

  logger.success(`处理完成！`);
  logger.info(`输出目录: ${config.outputDir}`);
}
