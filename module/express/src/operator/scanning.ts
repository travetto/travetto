import { Injectable, DependencyRegistry } from '@travetto/di';
import { ExpressOperatorSet, ExpressOperator } from '@travetto/express/src/types';
import { ConfigLoader } from '@travetto/config';
import { Class } from '@travetto/registry';
import { AppInfo } from '@travetto/base';

@Injectable({
  target: ExpressOperatorSet
})
export class ScanningOperatorSet extends ExpressOperatorSet {

  async postConstruct() {
    const operators = ConfigLoader.get('registry.express.operator') as { [key: string]: Set<string> };

    for (const k of Object.keys(operators)) {
      operators[k] = new Set(operators[k]);
    }

    const items = DependencyRegistry.getCandidateTypes(ExpressOperator as Class);

    const out: Class<ExpressOperator>[] = [];
    for (const item of items) {
      const file = item.class.__filename;
      let target = AppInfo.NAME;
      if (file.includes('node_modules')) {
        target = file.replace(/^.*(@travetto\/[^\/]+).*/, (a, key) => key);
      }

      if (operators[target] && operators[target].has(item.class.name)) {
        out.push(item.class as Class<ExpressOperator>);
      }
    }

    this.operators = new Set(out);
  }
}
