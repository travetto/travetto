import { Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-web';
import { Injectable } from '@travetto/di';
import { WebResponse, WebRequest } from '@travetto/web';

@Injectable()
export class CustomCodec implements PrincipalCodec {
  decode(req: WebRequest): Promise<Principal | undefined> | Principal | undefined {
    const userId = req.headers.get('USER_ID');
    if (userId) {
      let p: Principal | undefined;
      // Lookup user from db, remote system, etc.,
      return p;
    }
    return;
  }
  encode(res: WebResponse, data: Principal | undefined): WebResponse {
    if (data) {
      res.headers.set('USER_ID', data.id);
    }
    return res;
  }
}