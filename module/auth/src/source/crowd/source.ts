import * as http from 'http';

import { requestJSON } from '@travetto/util';

import { AuthCrowdConfig } from './config';
import { AuthSource } from '../source';
import { PrincipalProvider } from '../../principal';

export class AuthCrowdSource<U> extends AuthSource<U, PrincipalProvider<U>> {
  constructor(public config: AuthCrowdConfig) {
    super();
  }

  private async request<Z, Y>(path: string, options: http.RequestOptions = {}, data?: Y) {
    return await requestJSON<Z, Y>({
      auth: `${this.config.application}:${this.config.password}`,
      url: `${this.config.baseUrl}/rest/usermanagement/latest${path}`
    }, data);
  }

  async fetchPrincipal(username: string) {
    return await this.request<U, any>(`/user?username=${username}`);
  }

  async login(username: string, password: string) {
    return await this.request<U, any>(`/authentication?username=${username}`, {
      method: 'POST',
    }, { value: password });
  }
}