import { Class } from '@travetto/base';

import { InterceptorUtil } from '../util/interceptor';
import { DisabledConfig, PathAwareConfig, RouteApplies } from './types';

type InterceptorType = {
  applies?: RouteApplies;
  postConstruct?(): void | Promise<void>;
  config: DisabledConfig & PathAwareConfig;
};

export function ConfiguredInterceptor() {
  return <T extends InterceptorType>(tgt: Class<T>): void => {
    const pc = tgt.prototype.postConstruct;
    const ap = tgt.prototype.applies;
    tgt.prototype.postConstruct = function (this: InterceptorType): void | Promise<void> {
      if (this.config.paths?.length) {
        const checker = InterceptorUtil.buildRouteChecker(this.config.paths);
        this.applies = (route, controller): boolean =>
          (this.config.disabled !== true) && (ap ? ap.call(this, route, controller) : true) && checker(route, controller);
      }
      return pc.call(this);
    };
  };
}