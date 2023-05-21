import { Config } from '@travetto/config';

type RestClientProvider = {
  type: 'angular' | 'fetch';
  output: string;
};

@Config('rest.client')
export class RestClientConfig {
  providers: RestClientProvider[];
}