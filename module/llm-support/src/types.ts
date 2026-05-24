export interface InstallGuidance {
  id: string;
  title: string;
  required: string[];
  optional: string[];
  notes: string[];
}

export interface DependencyGraphNode {
  package: string;
  requires: string[];
  optionalAdapters: string[];
}

export interface WorkflowGuidance {
  id: string;
  title: string;
  intent: string;
  recommendedModules: string[];
  optionalModules: string[];
  commandDiscoveryRule: string;
  verification: string[];
}
