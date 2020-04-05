import { AuthInterceptor } from '..';

const { SessionInterceptor } = require('@travetto/rest-session');
const arr = (AuthInterceptor.prototype.after = AuthInterceptor.prototype.after ?? []) as any[];
arr.push(SessionInterceptor);