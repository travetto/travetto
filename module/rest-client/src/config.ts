import { Config } from '@travetto/config';

export type RestClientProvider = {
  type:
  'angular' | 'fetch-node' | 'fetch-web' |
  'rpc-angular' | 'rpc-node' | 'rpc-web';
  output: string;
  moduleName?: string;
  options?: object;
};

@Config('rest.client')
export class RestClientConfig {
  providers: RestClientProvider[] = [];
}