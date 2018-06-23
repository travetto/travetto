import * as qs from 'querystring';
import * as URL from 'url';

import { request } from '@travetto/util';

export class OAuth2Source {

  public authMethod = 'Bearer';
  public accessTokenName = 'access_token';
  public useAuthorizationHeaderForGET = false;
  public agent?: string;

  constructor(
    public clientId: string,
    public clientSecret: string,
    public baseSite: string,
    public authorizeURL: string = '/oauth/authorize',
    public accessTokenPath: string = '/oauth/access_token',
    public customHeaders: { [key: string]: string } = {}
  ) { }

  get accessTokenURL(): string {
    return `${this.baseSite}${this.accessTokenURL}`;
  }

  protected async request(method: 'GET' | 'POST', url: string, headers: { [key: string]: string } = {}, post_body?: string, access_token?: string) {
    const parsedUrl = URL.parse(url, true);

    const len = !post_body ? 0 :
      (Buffer.isBuffer(post_body) ?
        post_body.length : Buffer.byteLength(post_body));

    const finalHeaders = {
      'User-Agent': this.agent || 'travetto-auth',
      ...this.customHeaders,
      ...headers,
      Host: parsedUrl.host,
      'Content-Length': len
    };

    if (access_token && !('Authorization' in finalHeaders)) {
      if (!parsedUrl.query) {
        parsedUrl.query = {};
      }
      parsedUrl.query[this.accessTokenName] = access_token;
    }

    let queryStr = qs.stringify(parsedUrl.query);
    if (queryStr) {
      queryStr = `?${queryStr}`;
    }

    return await request({
      url,
      path: `${parsedUrl.pathname}?${queryStr}`,
      method,
      headers: finalHeaders,
    }, post_body);
  }

  buildAuthHeader(token: string) {
    return `${this.authMethod} ${token}`;
  }

  getAuthorizeUrl(params: { [key: string]: string }) {
    params.client_id = this.clientId;
    return `${this.baseSite}${this.authorizeURL}?${qs.stringify(params)}`;
  }

  getProtectedResource(url: string, access_token: string) {
    return this.request('GET', url, {}, undefined, access_token);
  }

  get(url: string, access_token: string) {
    const headers: { [key: string]: string } = {};
    if (this.useAuthorizationHeaderForGET) {
      headers.Authorization = this.buildAuthHeader(access_token);
    }

    return this.request('GET', url, headers, undefined, access_token);
  }

  async getOAuthAccessToken(code: string, params: { [key: string]: string } = {}) {
    const tokenType = params.grant_type === 'refresh_token' ? 'refresh_token' : 'code';

    params = {
      ...params,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      [tokenType]: code
    };

    const post_data = qs.stringify(params);
    const post_headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const data = await this.request('POST', this.accessTokenURL, post_headers, post_data, undefined);
    let results: { access_token: string, refresh_token: string } & { [key: string]: string };

    try {
      results = JSON.parse(data);
    } catch (e) {
      results = qs.parse(data) as any;
    }

    return results;
  }
}
