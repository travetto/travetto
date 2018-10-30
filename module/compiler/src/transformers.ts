import { ScanApp, Util } from '@travetto/base';

export class TransformerManager {

  transformers: ts.CustomTransformers = {};

  constructor() { }

  init() {
    const transformers: { [key: string]: any } = {};

    for (const trns of ScanApp.requireFiles('.ts', x => /transformer[.].*?[.]ts$/.test(x))) {
      for (const key of Object.keys(trns)) {
        const item = trns[key];
        if (!transformers[item.phase]) {
          transformers[item.phase] = [];
        }
        item.name = item.name || key;
        transformers[item.phase].push(item);
      }
    }
    for (const key of Object.keys(transformers)) {
      transformers[key] = Util.computeOrdering(transformers[key] as {
        transformer: any,
        before: string | string[],
        key: string
      }[]);
      console.debug('Configured Transformers', key, transformers[key].map((x: any) => x.key));
      transformers[key] = transformers[key].map((x: any) => x.transformer);
    }

    this.transformers = transformers;
  }
}