import { TypedObject } from '@travetto/base';

import { node } from './nodes';
import { MOD_MAPPING } from './mod-mapping';

export const mod = TypedObject.fromEntries(
  TypedObject.entries(MOD_MAPPING).map(([k, v]) => [k, node.Mod(v.name, v)])
);