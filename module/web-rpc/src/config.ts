import { Config } from '@travetto/config';

export type WebRpcClient = {
  type: 'node' | 'web';
  output: string;
};

/**
 * Web body parse configuration
 */
@Config('web.rpc')
export class WebRpcConfig {
  clients: WebRpcClient[] = [];
}
