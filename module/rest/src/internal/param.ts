import { BindUtil } from '@travetto/schema';
import { ParamConfig } from '../types';

const QuerySchemaⲐ: unique symbol = Symbol.for('@trv:rest/schema-query');

declare global {
  interface TravettoRequest {
    [QuerySchemaⲐ]: Record<string, unknown>;
  }
}

export function querySchemaParamConfig(config: Partial<ParamConfig> & { view?: string, key?: string } = {}): ParamConfig {
  return {
    ...config,
    location: 'query',
    resolve: ({ req }): void => {
      const val = BindUtil.expandPaths(req.query);
      req[QuerySchemaⲐ] ??= {};
      req[QuerySchemaⲐ][config.name!] = config.key ? val[config.key] : val;
    },
    extract: (c, req) => req![QuerySchemaⲐ][c.name!]
  };
}
