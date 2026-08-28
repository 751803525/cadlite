import inquirer from 'inquirer';

export interface StepsSelection {
  selectedSteps: number[];
  mode: 'merged' | 'split' | 'both';
  targetFaces: number;
  keepTemp: boolean;
}

export async function promptStepsSelect(): Promise<StepsSelection> {
  // 不使用泛型，直接传入问题数组，然后对返回值进行类型断言
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'steps',
      message: '请选择需要执行的功能（空格选中，不选则只执行解析）:',
      choices: [
        { name: '[3] 转换零件 → GLB', value: 3 },
        { name: '[4] 减面优化', value: 4 },
        { name: '[5] 实例化去重', value: 5 },
        { name: '[6] 合并输出', value: 6 },
      ],
      validate(input: any) {
        if (Array.isArray(input)) {
          if (input.includes(4) && !input.includes(3)) {
            return '减面(4)需要先执行转换(3)';
          }
          if (input.includes(5) && !input.includes(3)) {
            return '去重(5)需要先执行转换(3)';
          }
          if (input.includes(6) && !input.includes(3)) {
            return '合并(6)需要先执行转换(3)';
          }
        }
        return true;
      },
    },
  ]);
  // 类型断言，因为 inquirer 返回的是 any，我们知道结构
  const steps = (answers as { steps: number[] }).steps;

  let mode: 'merged' | 'split' | 'both' = 'both';
  if (steps.includes(6)) {
    const modeAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'outputMode',
        message: '选择合并输出模式:',
        choices: [
          { name: '单包 GLB', value: 'merged' },
          { name: '散装 + Manifest', value: 'split' },
          { name: '两种都生成', value: 'both' },
        ],
      },
    ]);
    mode = (modeAnswers as { outputMode: 'merged' | 'split' | 'both' }).outputMode;
  }

  let targetFaces = 5000;
  if (steps.includes(4)) {
    const facesAnswers = await inquirer.prompt([
      {
        type: 'number',
        name: 'faces',
        message: '目标面数（0=不限制）:',
        default: 5000,
        validate: (input: any) => {
          const num = Number(input);
          return Number.isFinite(num) && num >= 0 ? true : '请输入非负整数';
        },
      },
    ]);
    targetFaces = (facesAnswers as { faces: number }).faces;
  }

  const keepTempAnswers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'keepTemp',
      message: '保留临时文件（调试用）?',
      default: false,
    },
  ]);
  const keepTemp = (keepTempAnswers as { keepTemp: boolean }).keepTemp;

  return {
    selectedSteps: steps,
    mode,
    targetFaces,
    keepTemp,
  };
}
