import { Config } from '@travetto/config';
import { ManagedInterceptorConfig } from '@travetto/rest';

export type RestRpcClient = {
  type: 'angular' | 'node' | 'web';
  output: string;
};

/**
 * Rest body parse configuration
 */
@Config('rest.rpc')
export class RestRpcConfig extends ManagedInterceptorConfig {
  clients: RestRpcClient[] = [];
}
