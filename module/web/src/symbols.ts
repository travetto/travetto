const ProviderEntity: unique symbol = Symbol.for('@travetto/web:provider');
const TravettoEntity: unique symbol = Symbol.for('@travetto/web:travetto');
const NodeEntity: unique symbol = Symbol.for('@travetto/web:node');
const RequestParams: unique symbol = Symbol.for('@travetto/web:request-params');
const RequestLogging: unique symbol = Symbol.for('@travetto/web:request-logging');
const MissingParam: unique symbol = Symbol.for('@travetto/web:request-param-missing');
const RawBody: unique symbol = Symbol.for('@travetto/web:raw-body');
const HeadersAdded: unique symbol = Symbol.for('@travetto/web:headers');
const InterceptorConfigs: unique symbol = Symbol.for('@travetto/web:interceptors');
const ParsedType: unique symbol = Symbol.for('@travetto/web:content-type');
const QueryExpanded: unique symbol = Symbol.for('@travetto/web:query-expanded');
const GlobalEndpoint: unique symbol = Symbol.for('@travetto/web:global-endpoint');
const EndpointChecker: unique symbol = Symbol.for('@travetto/web:endpoint-checker');

export const WebSymbols = {
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
  GlobalEndpoint,
  EndpointChecker
} as const;