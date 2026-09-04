declare module 'opencascade.js' {
  export interface EmscriptenFS {
    writeFile(path: string, data: string | ArrayBufferView, opts?: any): void;
    readFile(path: string, opts?: { encoding?: 'binary' | 'utf8' }): Uint8Array | string;
    unlink(path: string): void;
    mkdir(path: string): void;
  }

  export interface OpenCascadeInstance {
    FS: EmscriptenFS;

    // 核心 XDE 与 STEP 接口类型存根
    XCAFApp_Application: any;
    Handle_TDocStd_Document_2: any;
    TDocStd_Document: any;
    TCollection_ExtendedString_2: any;
    STEPCAFControl_Reader: any;
    STEPCAFControl_Writer: any;
    XCAFDoc_DocumentTool: any;
    TDF_LabelSequence_1: any;
    TopLoc_Location_1: any;
    TDataStd_Name: any;
    Handle_TDataStd_Name_1: any;
    XCAFDoc_ShapeTool: any;
    STEPControl_StepModelType: any;
    Message_ProgressRange_1: any;
    IFSelect_ReturnStatus: {
      IFSelect_RetDone: number;
      [key: string]: any;
    };
    [key: string]: any; // 允许动态调用 OpenCASCADE 其他底层 API
  }
}
