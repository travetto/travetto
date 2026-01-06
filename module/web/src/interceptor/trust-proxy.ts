import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { castTo } from '@travetto/runtime';

import type { WebInterceptor, WebInterceptorContext } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebResponse } from '../types/response.ts';
import type { WebChainedContext } from '../types/filter.ts';

@Config('web.trustProxy')
export class TrustProxyConfig {
  /**
   * Enforces trust rules for X-Forwarded-* headers
   */
  applies = true;
  /**
   * The accepted ips
   */
  ips: string[] = [];
}

@Injectable()
export class TrustProxyInterceptor implements WebInterceptor<TrustProxyConfig> {

  category: WebInterceptorCategory = 'pre-request';

  @Inject()
  config: TrustProxyConfig;

  applies({ config }: WebInterceptorContext<TrustProxyConfig>): boolean {
    return config.applies;
  }

  filter({ request, next, config }: WebChainedContext<TrustProxyConfig>): Promise<WebResponse> {
    const forwardedFor = request.headers.get('X-Forwarded-For');

    if (forwardedFor) {
      const connection = request.context.connection ?? {};
      if (config.ips[0] === '*' || (connection.ip && config.ips.includes(connection.ip))) {
        connection.httpProtocol = castTo(request.headers.get('X-Forwarded-Proto')!) || connection.httpProtocol;
        connection.host = request.headers.get('X-Forwarded-Host') || connection.host;
        connection.ip = forwardedFor;
        Object.assign(request.context, { connection });
      }
    }

    request.headers.delete('X-Forwarded-For');
    request.headers.delete('X-Forwarded-Proto');
    request.headers.delete('X-Forwarded-Host');

    return next();
  }
}