import * as http from 'http';

import { requestJSON } from '@travetto/util';
import { Config } from '@travetto/config';

import { AuthProvider } from '../src/provider';
import { PrincipalConfig } from '../src/principal';

@Config('auth.crowd')
export class AuthCrowdConfig {
  baseUrl: string;
  application: string;
  password: string;
}

export class AuthCrowdProvider<U> extends AuthProvider<U, PrincipalConfig<U>> {
  constructor(public config: AuthCrowdConfig, principalConfig: PrincipalConfig<U>) {
    super(principalConfig);
  }

  private async request<Z, Y>(path: string, options: http.RequestOptions = {}, data?: Y) {
    return await requestJSON<Z, Y>({
      auth: `${this.config.application}:${this.config.password}`,
      url: `${this.config.baseUrl}/rest/usermanagement/latest${path}`
    }, data);
  }

  async retrieve(username: string) {
    return await this.request<U, any>(`/user?username=${username}`);
  }

  async login(username: string, password: string) {
    return await this.request<U, any>(`/authentication?username=${username}`, {
      method: 'POST',
    }, { value: password });
  }
}