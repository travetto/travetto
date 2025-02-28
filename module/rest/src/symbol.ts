const ProviderEntity: unique symbol = Symbol.for('@travetto/rest:provider');
const TravettoEntity: unique symbol = Symbol.for('@travetto/rest:travetto');

export const RestSymbols = {
  NodeEntity: Symbol.for('@travetto/rest:node'),
  RequestParams: Symbol.for('@travetto/rest:request-params'),
  RequestLogging: Symbol.for('@travetto/rest:request-logging'),
  MissingParam: Symbol.for('@travetto/rest:request-param-missing'),
  RawBody: Symbol.for('@travetto/rest:raw-body'),
  HeadersAdded: Symbol.for('@travetto/rest:headers'),
  InterceptorConfigs: Symbol.for('@travetto/rest:interceptors'),
  ParsedType: Symbol.for('@travetto/rest:content-type'),
  QueryExpanded: Symbol.for('@travetto/rest:query-expanded'),
  GlobalRoute: Symbol.for('@travetto/rest:global-route'),
  ProviderEntity,
  TravettoEntity,
} as const;