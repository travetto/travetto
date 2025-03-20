import { Class } from '@travetto/runtime';
import { HttpInterceptor, HttpInterceptorGroup } from './types';

class Basic {
  placeholder = true;
  intercept(): void { }
}

class RequestGroupStart extends Basic { }
class RequestGroupEnd extends Basic { dependsOn = [ResponseGroupStart]; }
class ResponseGroupStart extends Basic { dependsOn = [RequestGroupEnd]; }
class ResponseGroupEnd extends Basic { dependsOn = [ResponseGroupStart]; }
class ApplicationGroupStart extends Basic { dependsOn = [ResponseGroupEnd]; }
class ApplicationGroupEnd extends Basic { dependsOn = [ApplicationGroupStart]; }

const group = (start: Class<HttpInterceptor>, end: Class<HttpInterceptor>): HttpInterceptorGroup => ({ group: [start, end] });

export const InterceptorGroup = {
  Request: group(RequestGroupStart, RequestGroupEnd),
  Response: group(ResponseGroupStart, ResponseGroupEnd),
  Application: group(ApplicationGroupStart, ApplicationGroupEnd),
};