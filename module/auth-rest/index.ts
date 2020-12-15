/// <reference path="./src/typings.d.ts" />
export * from './src/interceptor';
export * from './src/decorator';
export * from './src/identity';
export * from './src/service';
export * from './src/context';
export * from './src/encoder';

// Named export needed for proxying
export { PassportIdentitySource } from './src/extension/passport/identity';
export { PassportInterceptor } from './src/extension/passport/interceptor';
