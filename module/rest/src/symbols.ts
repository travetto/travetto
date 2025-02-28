const ProviderEntity: unique symbol = Symbol.for('@travetto/rest:provider');
const TravettoEntity: unique symbol = Symbol.for('@travetto/rest:travetto');
const NodeEntity: unique symbol = Symbol.for('@travetto/rest:node');
const RequestParams: unique symbol = Symbol.for('@travetto/rest:request-params');
const RequestLogging: unique symbol = Symbol.for('@travetto/rest:request-logging');
const MissingParam: unique symbol = Symbol.for('@travetto/rest:request-param-missing');
const RawBody: unique symbol = Symbol.for('@travetto/rest:raw-body');
const HeadersAdded: unique symbol = Symbol.for('@travetto/rest:headers');
const InterceptorConfigs: unique symbol = Symbol.for('@travetto/rest:interceptors');
const ParsedType: unique symbol = Symbol.for('@travetto/rest:content-type');
const QueryExpanded: unique symbol = Symbol.for('@travetto/rest:query-expanded');
const GlobalRoute: unique symbol = Symbol.for('@travetto/rest:global-route');

export const RestSymbols = {
  ProviderEntity,
  TravettoEntity,
  NodeEntity,
  RequestParams,
  RequestLogging,
  MissingParam,
  RawBody,
  HeadersAdded,
  InterceptorConfigs,
  ParsedType,
  QueryExpanded,
  GlobalRoute,
} as const;