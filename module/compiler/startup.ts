import { Compiler } from './src/compiler';

export const init = {
  action: () => Compiler.init(process.cwd()),
  priority: 1
};