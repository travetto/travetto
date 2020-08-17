import { BasePackPlugin } from './pack-base';
import { Pack } from './operation/pack';

export class PackPlugin extends BasePackPlugin { operation = Pack; }