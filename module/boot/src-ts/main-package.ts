import { readPackage } from './internal/package';
import { PathUtil } from './path';

export const Package = readPackage(PathUtil.cwd, true);