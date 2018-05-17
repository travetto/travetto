import { bulkRequire } from '@travetto/base';
import { CustomTransformers } from 'typescript';

export class TransformerManager {
  pattern = /transformer[.].*[.]ts$/;

  transformers: CustomTransformers = {};

  constructor(private cwd: string) {
    const transformers: { [key: string]: any } = {};
    let i = 2;

    const fns = bulkRequire([this.pattern], `${this.cwd}/transformer`)
      .concat(bulkRequire([this.pattern], `${this.cwd}/node_modules/@travetto`))

    for (const trns of fns) {
      for (const key of Object.keys(trns)) {
        const item = trns[key];
        if (!transformers[item.phase]) {
          transformers[item.phase] = [];
        }
        item.priority = item.priority === undefined ? ++i : item.priority;
        item.name = item.name || key;
        transformers[item.phase].push(item);
      }
    }
    for (const key of Object.keys(transformers)) {
      transformers[key] = (transformers[key] as any[]).sort((a, b) => a.priority - b.priority).map(x => x.transformer);
    }
    this.transformers = transformers;
  }
}