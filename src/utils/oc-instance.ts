import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const opencascadeModule = require('opencascade.js/dist/opencascade.full.js');

const initOpenCascade =
  typeof opencascadeModule === 'function'
    ? opencascadeModule
    : opencascadeModule.default || opencascadeModule.initOpenCascade || opencascadeModule;

let ocInstance: any = null;

export async function getOcInstance() {
  if (!ocInstance) {
    if (typeof initOpenCascade !== 'function') {
      console.error('当前 opencascadeModule 导出内容为:', opencascadeModule);
      throw new TypeError('未能成功获取 initOpenCascade 函数，请检查导出路径！');
    }
    ocInstance = await initOpenCascade();
  }
  return ocInstance;
}

/**
 * 彻底解决 TCollection_ExtendedString 与 Handle 构造函数参数匹配问题的 XCAF 创建方案
 */
export function createXcafDocument(oc: any) {
  const appHandle = oc.XCAFApp_Application.GetApplication();
  const app = appHandle.get();

  // 1. 无参构造 ExtendedString，再写入字符串
  const formatName = new oc.TCollection_ExtendedString_1();
  formatName.AssignCat_1('MDTV-XCAF');

  // 2. 构造 TDocStd_Document 实体
  const doc = new oc.TDocStd_Document(formatName);

  // 3. 将文档附加到 Application 并获取 Safe Handle 句柄
  app.InitDocument(doc);
  const docHandle = doc.GetHandle();

  return { app, doc, docHandle };
}
