const Internal: unique symbol = Symbol.for('@travetto/web:internal');
const MissingParam: unique symbol = Symbol.for('@travetto/web:request-param-missing');
const GlobalEndpoint: unique symbol = Symbol.for('@travetto/web:global-endpoint');
const EndpointChecker: unique symbol = Symbol.for('@travetto/web:endpoint-checker');

export const WebSymbols = {
  Internal,
  MissingParam,
  GlobalEndpoint,
  EndpointChecker
} as const;