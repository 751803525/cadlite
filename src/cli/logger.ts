import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ') + ' ' + msg),
  success: (msg: string) => console.log(chalk.green('✓') + ' ' + msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠') + ' ' + msg),
  error: (...args: unknown[]) => {
    const messages = args.map((arg) => {
      if (arg instanceof Error) {
        return arg.message;
      }
      if (typeof arg === 'object') {
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
  step: (step: number, msg: string) => console.log(chalk.cyan(`[${step}]`) + ' ' + msg),
  line: () => console.log(''),
};
