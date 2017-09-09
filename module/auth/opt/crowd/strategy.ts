import * as http from 'http';

import { requestJSON } from '@encore2/util';
import { Injectable } from '@encore2/di';

import { CrowdStrategyConfig } from './config';
import { BaseStrategy } from '../../src/service/strategy';

@Injectable()
export class CrowdStrategy<T> extends BaseStrategy<T, CrowdStrategyConfig> {
  constructor(config: CrowdStrategyConfig) {
    super(config);
  }

  private async request<Z, U>(path: string, options: http.RequestOptions = {}, data?: U) {
    return await requestJSON<Z, U>({
      auth: `${this.config.application}:${this.config.password}`,
      url: `${this.config.baseUrl}/rest/usermanagement/latest${path}`
    }, data);
  }

  async getUser(username: string) {
    return await this.request<T, any>(`/user?username=${username}`);
  }

  async doLogin(username: string, password: string) {
    return await this.request<T, any>(`/authentication?username=${username}`, {
      method: 'POST',
    }, { value: password });
  }
}