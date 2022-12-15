import { node } from './nodes';
import { MOD_MAPPING } from './mod-mapping';

export const mod = Object.fromEntries(
  Object.entries(MOD_MAPPING).map(([k, v]) => [k, node.Mod(v.name, v)])
);