import { ParamConfig } from './shared/types';

export type Imp = { name: string, file: string, classId: string };

export type RenderContent = Imp & {
  imports: Imp[];
  content: (string | Imp)[];
};

export type EndpointDesc = {
  returnType: (string | Imp)[];
  paramInputs: (string | Imp)[];
  paramConfigs: ParamConfig[];
  imports: Imp[];
};
