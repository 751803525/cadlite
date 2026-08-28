import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ') + ' ' + msg),
  success: (msg: string) => console.log(chalk.green('✓') + ' ' + msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠') + ' ' + msg),
  step: (step: number, total: number, msg: string) =>
    console.log(chalk.cyan(`[${step}/${total}]`) + ' ' + msg),
  line: () => console.log(''),
  error: (...args: unknown[]) => {
    const messages = args.map((arg) => {
      if (arg instanceof Error) {
        // 如果是 Error 对象，优先显示其 message
        // 在开发环境（或通过环境变量控制）可以加上 stack
        return arg.message;
      }
      if (typeof arg === 'object') {
        // 如果是普通对象，尝试转为 JSON 字符串，否则显示其字符串表示
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    });
    console.log(chalk.red('✗') + ' ' + messages.join(' '));
  },
};
