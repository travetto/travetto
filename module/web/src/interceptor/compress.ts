import compression from 'compression';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { castTo, Util } from '@travetto/runtime';

import { FilterContext } from '../types';
import { ManagedInterceptorConfig, HttpInterceptor } from './types';
import { SerializeInterceptor } from './serialize';
import { WebSymbols } from '../symbols';

type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

@Config('web.compress')
class CompressConfig extends ManagedInterceptorConfig {
  /**
   * zlib chunk size
   */
  chunkSize = 2 ** 14;

  /**
   * zlib compression Level
   */
  level?: Digit | -1 | 0 = -1;

  /**
   * zlib memory usage
   */
  memLevel?: Digit = 8;

  /**
   * Limit before sending bytes
   */
  threshold = 2 ** 10;

  /**
   * The size of the memory window in bits for compressing
   */
  windowBits = 15;
}

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
    this.#compression = compression(this.config);
  }

  async intercept(ctx: FilterContext<CompressConfig>): Promise<void> {
    const { promise, resolve, reject } = Util.resolvablePromise();

    if (!ctx.config.disabled) {
      // Decorate response with compression support
      this.#compression(
        castTo(ctx.req[WebSymbols.NodeEntity]),
        castTo(ctx.res[WebSymbols.NodeEntity]),
        err => { err ? reject(err) : resolve(); }
      );
      await promise;
    }
  }
}