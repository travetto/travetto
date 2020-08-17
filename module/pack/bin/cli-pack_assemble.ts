import { BasePackPlugin } from './pack-base';
import { Assemble } from './operation/assemble';

export class PackAssemblePlugin extends BasePackPlugin { operation = Assemble; }