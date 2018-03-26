import { ConfigLoader } from './src/service/config-loader';

export const init = {
  priority: 0,
  action: () => ConfigLoader.initialize()
}