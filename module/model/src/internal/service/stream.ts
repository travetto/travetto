import { Class } from '@travetto/base';
import { ModelType } from '../../types/model';

class Cls { id: string; }
export const StreamModel: Class<ModelType> = Cls;
export const STREAMS = '_streams';