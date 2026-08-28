import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 自动查找 FreeCAD 命令行工具 (freecadcmd)
 */
async function findFreeCADCmd(): Promise<string> {
  // 1. 环境变量
  if (process.env.FREECAD_CMD) {
    const customPath = process.env.FREECAD_CMD;
    if (await fileExists(customPath)) {
      logger.info(`使用环境变量指定的 FreeCAD: ${customPath}`);
      return customPath;
    }
    logger.warn(`环境变量 FREECAD_CMD 指向的路径不存在: ${customPath}`);
  }

  // 2. 系统 PATH
  try {
    const { stdout } = await execAsync('where freecadcmd', { timeout: 3000 });
    const paths = stdout.trim().split('\n').filter(Boolean);
    if (paths.length > 0) {
      logger.info(`从系统 PATH 找到 FreeCAD: ${paths[0]}`);
      return paths[0];
    }
  } catch {
    // 忽略
  }

  // 3. Windows 注册表
  try {
    const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\FreeCAD" /v InstallPath', {
      timeout: 3000,
    });
    const match = stdout.match(/InstallPath\s+REG_SZ\s+(.*)/);
    if (match && match[1]) {
      const installPath = match[1].trim();
      const cmdPath = path.join(installPath, 'bin', 'freecadcmd.exe');
      if (await fileExists(cmdPath)) {
        logger.info(`从注册表找到 FreeCAD: ${cmdPath}`);
        return cmdPath;
      }
    }
  } catch {
    // 忽略
  }

  // 4. 常见路径扫描
  const commonRoots = ['C:\\Program Files', 'C:\\Program Files (x86)', 'D:\\Program Files', 'D:\\'];
  for (const root of commonRoots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith('freecad')) {
          const binDir = path.join(root, entry.name, 'bin');
          const cmdPath = path.join(binDir, 'freecadcmd.exe');
          if (await fileExists(cmdPath)) {
            logger.info(`从常见目录找到 FreeCAD: ${cmdPath}`);
            return cmdPath;
          }
        }
      }
    } catch {
      // 忽略无法访问的目录
    }
  }

  throw new Error(
    '未找到 FreeCAD 命令行工具 (freecadcmd)。\n' +
      '请确保 FreeCAD 已安装，并执行以下任一操作：\n' +
      '  1. 设置环境变量 FREECAD_CMD 指向 freecadcmd.exe 的完整路径\n' +
      '  2. 将 FreeCAD 的 bin 目录添加到系统 PATH 中\n' +
      '  3. 将 FreeCAD 安装到标准位置（如 C:\\Program Files\\FreeCAD）'
  );
}

/**
 * 生成 FreeCAD Python 脚本，从命令行参数读取输入输出路径
 */
function generateFreeCADScript(): string {
  return `
import FreeCAD
import Part
import json
import sys

def main():
    if len(sys.argv) < 3:
        print("Usage: freecadcmd script.py <input_file> <output_file>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        doc = FreeCAD.open(input_path)
    except Exception as e:
        print("ERROR: Failed to open file:", e, file=sys.stderr)
        sys.exit(1)

    obj_map = {}
    for obj in doc.Objects:
        obj_map[obj.Name] = {
            "id": obj.Name,
            "name": obj.Label or obj.Name,
            "parentId": None,
        }

    for obj in doc.Objects:
        if hasattr(obj, 'InList'):
            for parent in obj.InList:
                if parent.Name in obj_map:
                    obj_map[obj.Name]["parentId"] = parent.Name
                    break

    parts = list(obj_map.values())
    FreeCAD.closeDocument(doc.Name)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "rootName": "Assembly",
            "parts": parts
        }, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
`;
}

export async function step2Parse(context: PipelineContext): Promise<void> {
  const { inputPath, outputDir } = context.config;
  logger.info(`解析: ${inputPath}`);

  try {
    const freecadCmd = await findFreeCADCmd();

    const tempDir = path.join(outputDir, '.cadlite-temp');
    await fs.mkdir(tempDir, { recursive: true });

    // 1. 复制输入文件到临时目录，使用纯英文名称
    const ext = path.extname(inputPath);
    const safeInputName = `model${ext}`; // 例如 model.step
    const safeInputPath = path.join(tempDir, safeInputName);
    await fs.copyFile(inputPath, safeInputPath);

    // 2. 定义临时输出路径（纯英文）
    const tmpJsonPath = path.join(tempDir, 'hierarchy.tmp.json');
    // 删除旧的临时文件
    try {
      await fs.unlink(tmpJsonPath);
    } catch {}

    // 3. 生成 Python 脚本
    const script = generateFreeCADScript();
    const scriptPath = path.join(tempDir, 'extract_bom.py');
    await fs.writeFile(scriptPath, script, 'utf-8');

    // 4. 执行 FreeCAD，传入安全路径
    const command = `"${freecadCmd}" "${scriptPath}" "${safeInputPath}" "${tmpJsonPath}"`;
    logger.info(`执行: ${command}`);

    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

    if (stderr) {
      logger.warn(`FreeCAD stderr: ${stderr}`);
      if (/ERROR|exception|Traceback/i.test(stderr)) {
        throw new Error(`FreeCAD 执行出错: ${stderr}`);
      }
    }

    if (!(await fileExists(tmpJsonPath))) {
      throw new Error('FreeCAD 执行后未生成 hierarchy.tmp.json 文件');
    }

    const content = await fs.readFile(tmpJsonPath, 'utf-8');
    const hierarchy = JSON.parse(content);

    context.hierarchy = hierarchy;

    // 5. 将结果移动到最终位置
    const jsonPath = path.join(outputDir, 'hierarchy.json');
    try {
      await fs.unlink(jsonPath);
    } catch {}
    await fs.rename(tmpJsonPath, jsonPath);

    // 6. 清理临时文件（如果 keepTemp 为 false）
    if (!context.config.keepTemp) {
      try {
        await fs.unlink(safeInputPath);
        await fs.unlink(scriptPath);
      } catch {}
    }

    logger.info(`找到 ${hierarchy.parts.length} 个零件`);
    logger.info(`📄 已生成: ${jsonPath}`);
  } catch (error) {
    logger.error('解析 STEP 文件失败:', error);
    throw new Error(
      `解析 STEP 文件失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
