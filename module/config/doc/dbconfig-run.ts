import { ConfigManager } from '@travetto/config';
import { DBConfig } from './dbconfig';

export async function main() {
  await ConfigManager.init();
  const obj = new DBConfig();

  (obj as unknown as { postConstruct(): void }).postConstruct();
  console.log('DBConfig', { ...obj });
}