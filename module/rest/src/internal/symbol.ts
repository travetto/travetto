export const NodeEntitySymbol = Symbol.for('@travetto/rest:node');
export const RequestParamsSymbol = Symbol.for('@travetto/rest:request-params');
export const RequestLoggingSymbol = Symbol.for('@travetto/rest:request-logging');
export const MissingParamSymbol = Symbol.for('@travetto/rest:request-param-missing');
export const ProviderEntitySymbol = Symbol.for('@travetto/rest:provider');
export const RawBodySymbol: unique symbol = Symbol.for('@travetto/rest:raw-body');
export const TravettoEntitySymbol: unique symbol = Symbol.for('@travetto/rest:travetto');
export const HeadersAddedSymbol: unique symbol = Symbol.for('@travetto/rest:headers');
export const InterceptorConfigsSymbol: unique symbol = Symbol.for('@travetto/rest:interceptors');
export const ParsedTypeSymbol = Symbol.for('@travetto/rest:content-type');
export const QueryExpandedSymbol = Symbol.for('@travetto/rest:query-expanded');