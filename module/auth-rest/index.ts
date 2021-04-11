/// <reference path="./src/typings.d.ts" />
export * from './src/interceptor';
export * from './src/decorator';
export * from './src/service';
export * from './src/extension/context/interceptor';
export * from './src/encoder';

// Named export needed for proxying
export { PassportAuthenticator } from './src/extension/passport/authenticator';
export { PassportInterceptor } from './src/extension/passport/interceptor';

// Named export needed for proxying
export { AuthContextInterceptor } from './src/extension/context/interceptor';
