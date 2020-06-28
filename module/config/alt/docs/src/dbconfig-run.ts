process.env.TRV_ENV = 'prod';
process.env.TRV_RESOURCE_ROOTS = 'alt/docs';
import { ConfigManager } from '../../../src/manager';
import { DBConfig } from './dbconfig';

(async function () {
  await ConfigManager.init();
  const obj = new DBConfig();
  (obj as any).postConstruct();
  console.log(obj);
})();