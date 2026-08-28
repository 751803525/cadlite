import inquirer from 'inquirer';

export interface OptionsResult {
  mode: 'merged' | 'split' | 'both';
  targetFaces: number;
  keepTemp: boolean;
}

export async function promptOptions(): Promise<OptionsResult> {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: '选择输出模式:',
      choices: [
        { name: '单包 GLB', value: 'merged' },
        { name: '散装 + Manifest', value: 'split' },
        { name: '两种都生成', value: 'both' },
      ],
    },
  ]);

  const { targetFaces } = await inquirer.prompt([
    {
      type: 'number',
      name: 'targetFaces',
      message: '目标面数（0=不限制）:',
      default: 5000,
      validate: (input: any) => (input >= 0 ? true : '请输入非负整数'),
    },
  ]);

  const { keepTemp } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'keepTemp',
      message: '保留临时文件（调试用）?',
      default: true,
    },
  ]);

  return { mode, targetFaces, keepTemp };
}
