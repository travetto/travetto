import { ResourceManager } from '@travetto/base';

(async function run() {
  (await ResourceManager.read('env.properties', 'utf8'))
    .split(/\n/g)
    .map(x => x.split(/\s*=\s*/))
    .reduce((a, [k, v]) => {
      a[k] = v;
      return a;
    }, process.env);

  const { ConfigManager } = await import('@travetto/config');
  await ConfigManager.init();
  console.log('Config', ConfigManager.get() as Record<string, string>);
}());