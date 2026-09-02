import type { PipelineContext } from '../types.js';
import { logger } from '../../cli/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { convertFileEncoding } from '../../utils/encoding-utils.js';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// 辅助：检查文件是否存在
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 寻找可用于执行 Python 脚本的 FreeCAD 解释器路径
 * 优先返回 FreeCAD 附带的 bin/python.exe，次选 freecadcmd.exe
 */
async function findFreeCADCmd(): Promise<{ exe: string; isPython: boolean }> {
  // 1. 优先使用自定义环境变量
  if (process.env.FREECAD_CMD) {
    const customPath = process.env.FREECAD_CMD;
    if (await fileExists(customPath)) {
      logger.info(`使用环境变量指定的 FreeCAD: ${customPath}`);
      const isPython = path.basename(customPath).toLowerCase().startsWith('python');
      return { exe: customPath, isPython };
    }
    logger.warn(`环境变量 FREECAD_CMD 指向的路径不存在: ${customPath}`);
  }

  // 2. 检查系统 PATH 中的 freecadcmd 或 python
  try {
    const { stdout } = await execAsync('where freecadcmd', { timeout: 3000 });
    const paths = stdout
      .trim()
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
    if (paths.length > 0) {
      const cmdPath = paths[0];
      const binDir = path.dirname(cmdPath);
      const pyPath = path.join(binDir, 'python.exe');

      // 优先使用同目录下的 python.exe
      if (await fileExists(pyPath)) {
        logger.info(`从系统 PATH 的 FreeCAD 目录找到 python.exe: ${pyPath}`);
        return { exe: pyPath, isPython: true };
      }

      logger.info(`从系统 PATH 找到 freecadcmd: ${cmdPath}`);
      return { exe: cmdPath, isPython: false };
    }
  } catch {
    // 忽略 where 命令失败
  }

  // 3. 检查 Windows 注册表
  try {
    const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\FreeCAD" /v InstallPath', {
      timeout: 3000,
    });
    const match = stdout.match(/InstallPath\s+REG_SZ\s+(.*)/);
    if (match && match[1]) {
      const installPath = match[1].trim();
      const binDir = path.join(installPath, 'bin');
      const pyPath = path.join(binDir, 'python.exe');
      const cmdPath = path.join(binDir, 'freecadcmd.exe');

      if (await fileExists(pyPath)) {
        logger.info(`从注册表找到 FreeCAD Python 解释器: ${pyPath}`);
        return { exe: pyPath, isPython: true };
      }
      if (await fileExists(cmdPath)) {
        logger.info(`从注册表找到 FreeCAD: ${cmdPath}`);
        return { exe: cmdPath, isPython: false };
      }
    }
  } catch {
    // 忽略注册表查询失败
  }

  // 4. 常见盘符与目录扫描（支持 C、D、E 盘等）
  const commonRoots = [
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'D:\\Program Files',
    'D:\\',
    'E:\\',
  ];
  for (const root of commonRoots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.toLowerCase().startsWith('freecad')) {
          const binDir = path.join(root, entry.name, 'bin');
          const pyPath = path.join(binDir, 'python.exe');
          const cmdPath = path.join(binDir, 'freecadcmd.exe');

          // 优先寻找 bin/python.exe，彻底避开 FreeCAD 1.0 的 -c/[no supported file format] 报错
          if (await fileExists(pyPath)) {
            logger.info(`从常见目录找到 FreeCAD Python: ${pyPath}`);
            return { exe: pyPath, isPython: true };
          }

          if (await fileExists(cmdPath)) {
            logger.info(`从常见目录找到 FreeCAD Command: ${cmdPath}`);
            return { exe: cmdPath, isPython: false };
          }
        }
      }
    } catch {
      // 忽略无权限或不存在的盘符目录
    }
  }

  throw new Error(
    '未找到 FreeCAD 或其 Python 解释器。\n' +
      '请确保 FreeCAD 已安装，并执行以下任一操作：\n' +
      '  1. 设置环境变量 FREECAD_CMD 指向 bin/python.exe 或 freecadcmd.exe\n' +
      '  2. 将 FreeCAD 的 bin 目录添加到系统 PATH 中'
  );
}

async function freecadcmd(
  exe: string,
  py: string,
  inputPath: string,
  outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 2. 将 -c 参数传入，确保以纯命令行交互模式启动 Python 脚本
    const args = [py, inputPath, outputDir];

    logger.info(`执行命令: ${exe} ${args.join(' ')}`);

    // 3. 不使用 shell: true，Node.js 会自动处理参数中带有空格的情况
    const child = spawn(exe, args, {
      shell: false,
      env: {
        ...process.env,
        // 强制 Python 标准输出为 UTF-8，防止 Windows 控制台打印中文零件名乱码
        PYTHONIOENCODING: 'utf-8',
      },
    });

    // 4. 解决 Windows CMD 下可能出现的 GBK/UTF8 跨进程编码截断
    child.stdout.on('data', (data: Buffer) => {
      const line = data.toString('utf-8').trim();
      if (line) logger.info(`[FreeCAD]: ${line}`);
    });

    child.stderr.on('data', (data: Buffer) => {
      const line = data.toString('utf-8').trim();
      // 忽略部分 freecad 启动时吐出的非致命 console 警告
      if (line) logger.warn(`[FreeCAD Error]: ${line}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`freecadcmd 进程异常退出，退出码: ${code}`));
      }
    });

    child.on('error', (err) => {
      logger.error(`无法启动 freecadcmd 进程，请检查路径是否存在: ${exe}`);
      reject(err);
    });
  });
}
/**
 * 步骤2：解析 STEP 文件，输出 hierarchy.json 和零件文件（STL 中间格式，随后转为 GLB）
 */
export async function step2Parse(context: PipelineContext): Promise<void> {
  const { config, tempDir } = context;
  const { inputPath } = config;
  logger.info(`解析: ${inputPath}`);
  const ext = path.extname(inputPath).toLocaleLowerCase();
  const encodingPath = path.join(tempDir, 'encoding', `temp${ext}`);
  await convertFileEncoding(inputPath, path.resolve(tempDir, encodingPath));

  const splitOutputDir = path.join(tempDir, 'split');
  const pyPath = path.join(__dirname, '../../scripts/step-split.py');
  const { exe } = await findFreeCADCmd();
  await freecadcmd(exe, pyPath, encodingPath, splitOutputDir);
  logger.info('拆分完成');
}
