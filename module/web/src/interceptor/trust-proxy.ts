import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { castTo } from '@travetto/runtime';
import { EndpointConfig, WebChainedContext, WebInterceptor, WebInterceptorCategory, WebResponse } from '@travetto/web';

@Config('web.trustProxy')
export class TrustProxyConfig {
  /**
   * Enforces trust rules for X-Forwarded-* headers
   */
  applies = true;
  /**
   * The accepted types
   */
  ips: string[] = [];
}

@Injectable()
export class TrustProxyInterceptor implements WebInterceptor<TrustProxyConfig> {

  category: WebInterceptorCategory = 'pre-request';

  @Inject()
  config: TrustProxyConfig;

  applies(endpoint: EndpointConfig, config: TrustProxyConfig): boolean {
    return config.applies;
  }

  filter({ req, next, config }: WebChainedContext<TrustProxyConfig>): Promise<WebResponse> {
    const forwardedFor = req.headers.get('X-Forwarded-For');

    if (forwardedFor) {
      const connection = req.context.connection ??= {};
      if (config.ips[0] === '*' || (connection.ip && config.ips.includes(connection.ip))) {
        connection.httpProtocol = castTo(req.headers.get('X-Forwarded-Proto')!) || connection.httpProtocol;
        connection.host = req.headers.get('X-Forwarded-Host') || connection.host;
        connection.ip = forwardedFor;
      }
    }

    req.headers.delete('X-Forwarded-For');
    req.headers.delete('X-Forwarded-Proto');
    req.headers.delete('X-Forwarded-Host');

    return next();
  }
}