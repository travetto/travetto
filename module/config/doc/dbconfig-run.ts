process.env.TRV_ENV = 'prod';
import { ConfigManager } from '@travetto/config';
import { DBConfig } from './dbconfig';

(async function () {
  await ConfigManager.init();
  const obj = new DBConfig();
  (obj as any).postConstruct();
  console.log('DBConfig', { ...obj });
})();