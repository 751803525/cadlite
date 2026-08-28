import inquirer from 'inquirer';

export interface FileSelectResult {
  inputPath: string;
  outputDir: string;
}

export async function promptFileSelect(defaults?: {
  inputPath?: string;
  outputDir?: string;
}): Promise<FileSelectResult> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputPath',
      message: '请输入 STEP/IGES 文件路径:',
      default: defaults?.inputPath,
      validate: (input: string) => {
        if (!input) return '请输入文件路径';
        return true;
      },
    },
    {
      type: 'input',
      name: 'outputDir',
      message: '请输入输出目录:',
      default: defaults?.outputDir || './output',
      validate: (input: string) => {
        if (!input) return '请输入输出目录';
        return true;
      },
    },
  ]);

  return answers;
}
