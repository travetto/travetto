import { BasePackPlugin } from './pack-base';
import { Zip } from './operation/zip';

export class PackZipPlugin extends BasePackPlugin { operation = Zip; }