import { AuthInterceptor } from '..';

const { AsyncContextInterceptor } = require('@travetto/context/extension/rest.interceptor');
const arr = (AuthInterceptor.prototype.after = AuthInterceptor.prototype.after || []) as any[];
arr.push(AsyncContextInterceptor);