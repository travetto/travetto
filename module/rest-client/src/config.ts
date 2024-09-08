import { Config } from '@travetto/config';

export type RestClientProvider = {
  type: 'angular' | 'fetch' | 'fetch-node' | 'fetch-web' | 'rest-rpc' | 'rest-rpc-web' | 'rest-rpc-node';
  output: string;
  moduleName?: string;
  options?: object;
};

@Config('rest.client')
export class RestClientConfig {
  providers: RestClientProvider[] = [];
}