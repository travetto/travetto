import { BindUtil } from '@travetto/schema';
import { ParamConfig } from '../types';

const QuerySchemaⲐ: unique symbol = Symbol.for('@travetto/rest:schema-query');

declare global {
  interface TravettoRequest {
    [QuerySchemaⲐ]: Record<string, unknown>;
  }
}

export function querySchemaParamConfig(config: Partial<ParamConfig> & { view?: string } = {}): ParamConfig {
  return {
    ...config,
    location: 'query',
    resolve: ({ req }): void => {
      const val = BindUtil.expandPaths(req.query);
      req[QuerySchemaⲐ] ??= {};
      req[QuerySchemaⲐ][config.name!] = config.prefix ? val[config.prefix] : val;
    },
    extract: (c, req) => req![QuerySchemaⲐ][c.name!],
  };
}
