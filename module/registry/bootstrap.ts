import { RootRegistry } from './src/service/root';

export const init = {
  priority: 2,
  action: () => RootRegistry.init()
};