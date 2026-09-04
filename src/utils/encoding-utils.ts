import fs from 'fs';
import path from 'path';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { logger } from '../cli/logger.js';

/**
 * 编码层级映射（子集 → 超集）
 */
const ENCODING_HIERARCHY: Record<string, string> = {
  ascii: 'utf8',
  'iso-8859-1': 'windows-1252',
  gb2312: 'gbk',
  // gbk: 'gb18030', // 取消映射，避免 iconv-lite 不支持
};

function getGenericEncoding(enc: string): string {
  const lower = enc.toLowerCase();
  return ENCODING_HIERARCHY[lower] || lower;
}

/**
 * 从检测结果列表中选择最优编码（频次+权重）
 */
function chooseBestEncoding(encodings: string[]): string {
  const freq: Record<string, number> = {};
  for (const enc of encodings) {
    const generic = getGenericEncoding(enc);
    freq[generic] = (freq[generic] || 0) + 1;
  }

  let maxCount = 0;
  for (const count of Object.values(freq)) {
    if (count > maxCount) maxCount = count;
  }

  const topCandidates = Object.keys(freq).filter((enc) => freq[enc] === maxCount);
  if (topCandidates.length === 1) return topCandidates[0];

  const hierarchyWeight: Record<string, number> = {
    utf8: 10,
    'windows-1252': 9,
    gbk: 8,
    gb18030: 7,
    big5: 6,
    gb2312: 5,
    'shift-jis': 5,
    'euc-kr': 5,
    'iso-8859-1': 4,
    ascii: 1,
  };
  topCandidates.sort((a, b) => (hierarchyWeight[b] || 0) - (hierarchyWeight[a] || 0));
  return topCandidates[0];
}

/**
 * 提取非 ASCII 连续片段（长度 > 4）
 */
function extractNonAsciiSegments(buffer: Buffer, minLength: number = 4): Buffer[] {
  const segments: Buffer[] = [];
  let start = -1;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] > 0x7f) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start > minLength) {
        segments.push(buffer.subarray(start, i));
        start = -1;
      }
    }
  }
  if (start !== -1 && buffer.length - start > minLength) {
    segments.push(buffer.subarray(start, buffer.length));
  }
  return segments;
}

/**
 * 智能检测文件编码（通用，不依赖扩展名）
 * 新策略：
 * 1. 先全局检测，若非 ISO/ASCII 则直接采用全局结果。
 * 2. 若全局为 ISO/ASCII，则提取非 ASCII 片段；
 *    若片段数 > 2，则进行投票+超集选择；
 *    若片段数 ≤ 2，则返回 defaultEncoding（避免误判）。
 * 3. 若无片段，则返回全局结果（通常是 ASCII）。
 *
 * @param filePath 文件路径
 * @param sampleSize 读取样本大小（默认 128KB）
 * @param defaultEncoding 当无法可靠检测时的默认编码（默认 'gbk'）
 * @returns 检测到的编码（小写字符串）
 */
export function detectFileEncodingSmart(
  filePath: string,
  sampleSize: number = 128 * 1024,
  defaultEncoding: string = 'gbk'
): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  // 读取样本
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(sampleSize);
  const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
  fs.closeSync(fd);
  const sample = buffer.subarray(0, bytesRead);

  // 1. 全局检测
  let global = chardet.detect(sample);
  if (Array.isArray(global)) global = global[0];
  const globalLower = global ? global.toLowerCase() : null;

  // 2. 如果全局不是 ISO-8859-1 且不是 ASCII，则信任全局
  if (globalLower && !['iso-8859-1', 'ascii'].includes(globalLower)) {
    return getGenericEncoding(globalLower);
  }

  // 3. 全局是 ISO 或 ASCII，提取非 ASCII 片段
  const segments = extractNonAsciiSegments(sample, 4);

  // 如果片段数 ≤ 2，认为不可靠，返回 defaultEncoding
  if (segments.length <= 2) {
    return defaultEncoding;
  }

  // 片段数 > 2，进行投票
  const detectedEncodings: string[] = [];
  for (const seg of segments) {
    let detected = chardet.detect(seg);
    if (Array.isArray(detected)) detected = detected[0];
    if (detected) detectedEncodings.push(detected);
  }

  if (detectedEncodings.length === 0) {
    return globalLower ? getGenericEncoding(globalLower) : defaultEncoding;
  }

  const chosen = chooseBestEncoding(detectedEncodings);
  return chosen !== 'ascii'
    ? chosen
    : globalLower
      ? getGenericEncoding(globalLower)
      : defaultEncoding;
}

/**
 * 转换文件编码（流式处理，自动检测源编码）
 */
export async function convertFileEncoding(
  inputPath: string,
  outputPath: string = '',
  targetEncoding: string = 'utf8',
  options: {
    outputDir?: string;
    fileName?: string;
    sampleSize?: number;
    sourceEncoding?: string;
    defaultEncoding?: string; // 新增
    verbose?: boolean;
    forceOverwrite?: boolean;
  } = {}
): Promise<void> {
  const verbose = options.verbose !== false;
  const forceOverwrite = options.forceOverwrite !== false;
  const defaultEncoding = options.defaultEncoding || 'gbk'; // 默认 gbk

  if (verbose) logger.info(`[encoding] 开始处理文件: ${inputPath}`);
  if (!fs.existsSync(inputPath)) throw new Error(`输入文件不存在: ${inputPath}`);

  // -------- 确定输出路径 --------
  let finalOutputPath: string;
  if (options.outputDir) {
    if (!fs.existsSync(options.outputDir)) fs.mkdirSync(options.outputDir, { recursive: true });
    const baseName = options.fileName || path.basename(inputPath);
    finalOutputPath = path.join(options.outputDir, baseName);
    if (verbose) logger.info(`[encoding] 输出目录: ${options.outputDir}, 文件名: ${baseName}`);
  } else {
    if (!outputPath) throw new Error('必须指定 outputPath 或 options.outputDir');
    finalOutputPath = outputPath;
  }

  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(finalOutputPath) && !forceOverwrite) {
    throw new Error(`输出文件已存在且 forceOverwrite=false: ${finalOutputPath}`);
  }

  if (verbose) {
    logger.info(`[encoding] 最终输出路径: ${finalOutputPath}`);
    logger.info(`[encoding] 目标编码: ${targetEncoding}`);
  }

  // -------- 确定源编码 --------
  let sourceEncoding = options.sourceEncoding;
  if (!sourceEncoding) {
    const sampleSize = options.sampleSize ?? 128 * 1024;
    if (verbose) logger.info(`[encoding] 正在智能检测源文件编码...`);
    const detected = detectFileEncodingSmart(inputPath, sampleSize, defaultEncoding);
    sourceEncoding = detected;
    if (verbose) logger.info(`[encoding] ✅ 检测到源编码: ${sourceEncoding}`);
  } else {
    if (verbose) logger.info(`[encoding] 手动指定源编码: ${sourceEncoding}`);
  }

  const srcEnc = sourceEncoding.toLowerCase();
  const tgtEnc = targetEncoding.toLowerCase();

  if (verbose) logger.info(`[encoding] 源: ${srcEnc}, 目标: ${tgtEnc}`);

  if (srcEnc === tgtEnc) {
    if (verbose) logger.info(`[encoding] 编码相同，直接复制`);
    await copyFileStream(inputPath, finalOutputPath);
    if (verbose) logger.info(`[encoding] ✅ 复制完成`);
    return;
  }

  if (verbose) logger.info(`[encoding] 开始流式转换...`);
  const readStream = fs.createReadStream(inputPath);
  const writeStream = fs.createWriteStream(finalOutputPath);
  const decodeStream = iconv.decodeStream(srcEnc);
  const encodeStream = iconv.encodeStream(tgtEnc);

  readStream.pipe(decodeStream).pipe(encodeStream).pipe(writeStream);

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      if (verbose) logger.info(`[encoding] ✅ 转码完成`);
      resolve();
    });
    writeStream.on('error', reject);
    readStream.on('error', reject);
    decodeStream.on('error', reject);
    encodeStream.on('error', reject);
  });
}

async function copyFileStream(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(src);
    const ws = fs.createWriteStream(dest);
    rs.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    rs.on('error', reject);
  });
}
