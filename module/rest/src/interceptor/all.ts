import { Injectable, DependencyRegistry } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AppInfo } from '@travetto/base/bootstrap';

import { RestInterceptorGroup } from './group';
import { RestInterceptor } from './interceptor';

@Injectable({ target: RestInterceptorGroup })
export class AllInterceptorGroup extends RestInterceptorGroup {

  async postConstruct() {
    const items = DependencyRegistry.getCandidateTypes(RestInterceptor as Class);

    const out: Class<RestInterceptor>[] = [];
    for (const item of items) {
      const file = item.class.__filename;
      let target = AppInfo.NAME;
      if (file.includes('node_modules')) {
        target = file.replace(/^.*(@travetto\/[^\/]+).*/, (a, key) => key);
      }
      out.push(item.class as Class<RestInterceptor>);
    }

    this.interceptors = new Set(out);
  }
}
