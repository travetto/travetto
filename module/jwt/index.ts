export * from './src/decode';
export * from './src/verify';
export * from './src/sign';
export * from './src/types';
export * from './src/error';
// Named export needed for proxying
export { JWTAuthContextEncoder } from './src/extension/auth-rest.encoder';