import { Config } from '@travetto/config';

export type RestClientProvider = {
  type: 'angular' | 'fetch' | 'fetch-node' | 'fetch-web';
  output: string;
  moduleName?: string;
};

@Config('rest.client')
export class RestClientConfig {
  providers: RestClientProvider[] = [];
}