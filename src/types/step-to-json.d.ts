declare module 'step-to-json' {
  interface StepToJsonParserOptions {
    // 如果有选项可以定义，但文档未提供，所以设为空
  }

  export class StepToJsonParser {
    constructor(fileBuffer: Buffer, options?: StepToJsonParserOptions);
    parse(): any; // 可以进一步定义返回结构，但为简化使用 any
  }

  export default StepToJsonParser;
}
