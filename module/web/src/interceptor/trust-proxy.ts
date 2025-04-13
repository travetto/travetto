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
      if (config.ips[0] === '*' || (req.connection.ip && config.ips.includes(req.connection.ip))) {
        req.connection.protocol = castTo(req.headers.get('X-Forwarded-Proto')!) || req.connection.protocol;
        req.connection.host = req.headers.get('X-Forwarded-Host') || req.connection.host;
        req.connection.ip = forwardedFor;
      }
    }

    req.headers.delete('X-Forwarded-For');
    req.headers.delete('X-Forwarded-Proto');
    req.headers.delete('X-Forwarded-Host');

    return next();
  }
}