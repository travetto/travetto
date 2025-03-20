import { HttpInterceptorGroup } from './types';

export const InterceptorGroup = {
  Request: new HttpInterceptorGroup('Request'),
  Response: new HttpInterceptorGroup('Response'),
  Application: new HttpInterceptorGroup('Application'),
};

InterceptorGroup.Response.dependsOn.push(InterceptorGroup.Request);
InterceptorGroup.Application.dependsOn.push(InterceptorGroup.Response);