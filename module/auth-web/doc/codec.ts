import { Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-web';
import { Injectable } from '@travetto/di';
import { BinaryUtil } from '@travetto/runtime';
import { WebResponse, WebRequest } from '@travetto/web';

@Injectable()
export class CustomCodec implements PrincipalCodec {
  secret: string;

  decode(request: WebRequest): Promise<Principal | undefined> | Principal | undefined {
    const [userId, sig] = request.headers.get('USER_ID')?.split(':') ?? [];
    if (userId && sig === BinaryUtil.hash(userId + this.secret)) {
      let principal: Principal | undefined;
      // Lookup user from db, remote system, etc.,
      return principal;
    }
    return;
  }
  encode(response: WebResponse, data: Principal | undefined): WebResponse {
    if (data) {
      response.headers.set('USER_ID', `${data.id}:${BinaryUtil.hash(data.id + this.secret)}`);
    }
    return response;
  }
}