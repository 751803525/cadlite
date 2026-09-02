export interface PipelineConfig {
  inputPath: string;
  outputDir: string;
  steps: number[];
  mode: 'merged' | 'split' | 'both';
  targetFaces: number;
  keepTemp: boolean;
}

export interface PipelineContext {
  config: PipelineConfig;
  tempDir: string;
  hierarchy: AssemblyHierarchy | null;
  parts: PartInfo[];
  optimizedParts: PartInfo[];
  dedupMap: DedupMap | null;
  mergedPath: string;
  keepTemp: boolean;
}

export interface AssemblyHierarchy {
  rootName: string;
  parts: PartNode[];
}

export interface PartNode {
  id: string;
  name: string;
  parentId: string | null;
  matrix: number[];
  meshFile?: string;
}

export interface PartInfo {
  id: string;
  name: string;
  originalGlb: string;
  optimizedGlb: string;
  faceCount: number;
  originalFaceCount: number;
}

export interface DedupMap {
  templates: TemplateInfo[];
  instances: InstanceInfo[];
}

export interface TemplateInfo {
  id: string;
  name: string;
  file: string;
  faceCount: number;
}

export interface InstanceInfo {
  templateId: string;
  partId: string;
  matrix: number[];
}
