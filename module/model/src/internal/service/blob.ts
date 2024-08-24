import { Class } from '@travetto/runtime';
import { ModelType } from '../../types/model';

export const ModelBlobNamespace = '__blobs';
export const MODEL_BLOB: Class<ModelType> = class { id: string; };