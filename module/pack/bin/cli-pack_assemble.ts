import { BasePackPlugin } from './pack-base';
import { Assemble, AssembleConfig } from './operation/assemble';

export class PackAssemblePlugin extends BasePackPlugin<AssembleConfig> { operation = Assemble; }