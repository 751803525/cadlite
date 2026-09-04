import fs from 'fs/promises';
import { logger } from '../cli/logger.js';
import path from 'path';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupDir(dir: string): Promise<void> {
  if (await fileExists(dir)) {
    logger.info(`开始清理临时目录: ${dir}`);
    await fs.rm(dir, { recursive: true, force: true });
    logger.info(`清理临时目录完成: ${dir}`);
  } else {
    logger.info(` ${dir} 目录不存在跳过清理！`);
  }
}
export async function copyDirectory(
  from: string,
  to: string,
  options = { overwrite: true }
): Promise<string> {
  // 确保目标目录存在
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      // 递归复制子目录
      await copyDirectory(fromPath, toPath, options);
    } else {
      // 复制文件（可控制是否覆盖）
      if (!options.overwrite) {
        try {
          await fs.access(toPath);
          continue; // 文件已存在且不允许覆盖，跳过
        } catch {}
      }
      await fs.copyFile(from, toPath);
    }
  }
  return to;
}
