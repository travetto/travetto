import compression from 'compression';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Util } from '@travetto/runtime';

import { FilterContext } from '../types';
import { ManagedInterceptorConfig, HttpInterceptor } from './types';
import { SerializeInterceptor } from './serialize';

@Config('web.compress')
class CompressConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class CompressInterceptor implements HttpInterceptor {

  runsBefore = [SerializeInterceptor];

  @Inject()
  config: CompressConfig;

  #compression: ReturnType<typeof compression>;

  postConstruct(): void {
    this.#compression = compression({});
  }

  async intercept(ctx: FilterContext): Promise<void> {
    const { promise, resolve, reject } = Util.resolvablePromise();
    // Decorate response with compression support
    this.#compression(ctx.req, ctx.res, (err) => { err ? reject(err) : resolve(); });
    await promise;
  }
}