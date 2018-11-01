import { Injectable, DependencyRegistry } from '@travetto/di';
import { ConfigLoader } from '@travetto/config';
import { Class } from '@travetto/registry';
import { AppInfo } from '@travetto/base';

import { RestInterceptorSet, RestInterceptor } from './types';

@Injectable({
  target: RestInterceptorSet
})
export class ScanningInterceptorSet extends RestInterceptorSet {

  async postConstruct() {
    const interceptors = ConfigLoader.get('registry.rest.interceptor') as { [key: string]: Set<string> };

    for (const k of Object.keys(interceptors)) {
      interceptors[k] = new Set(interceptors[k]);
    }

    const items = DependencyRegistry.getCandidateTypes(RestInterceptor as Class);

    const out: Class<RestInterceptor>[] = [];
    for (const item of items) {
      const file = item.class.__filename;
      let target = AppInfo.NAME;
      if (file.includes('node_modules')) {
        target = file.replace(/^.*(@travetto\/[^\/]+).*/, (a, key) => key);
      }
      if (interceptors[target] && interceptors[target].has(item.class.name)) { // Load if specified to be loaded, and it exists
        out.push(item.class as Class<RestInterceptor>);
      } else if (!item.class.__filename.includes('/extension/')) { // Auto load all non-ext interceptors
        out.push(item.class as Class<RestInterceptor>);
      }
    }

    this.interceptors = new Set(out);
  }
}
