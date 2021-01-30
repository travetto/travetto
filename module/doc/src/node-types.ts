import { All } from '@travetto/rest';
import * as n from './nodes';

export type AllTypeMap = { [K in keyof typeof n]: ReturnType<(typeof n)[K]> };
export type AllType = ReturnType<(typeof n)[keyof typeof n]>;
