import { Config } from '@travetto/config';
import { ManagedInterceptorConfig } from '@travetto/web';

export type WebRpcClient = {
  type: 'node' | 'web';
  output: string;
};

/**
 * Web body parse configuration
 */
@Config('web.rpc')
export class WebRpcConfig extends ManagedInterceptorConfig {
  clients: WebRpcClient[] = [];
  disabled = true;
}
