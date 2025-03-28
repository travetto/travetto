import { Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-web';
import { Injectable } from '@travetto/di';
import { HttpResponse, HttpRequest } from '@travetto/web';

@Injectable()
export class CustomCodec implements PrincipalCodec {
  decode(req: HttpRequest): Promise<Principal | undefined> | Principal | undefined {
    const userId = req.headers.get('USER_ID');
    if (userId) {
      let p: Principal | undefined;
      // Lookup user from db, remote system, etc.,
      return p;
    }
    return;
  }
  encode(res: HttpResponse, data: Principal | undefined): HttpResponse {
    if (data) {
      res.headers.set('USER_ID', data.id);
    }
    return res;
  }
}