import { Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-web';
import { Injectable } from '@travetto/di';
import { HttpPayload, HttpRequest } from '@travetto/web';

@Injectable()
export class CustomCodec implements PrincipalCodec {
  decode(req: HttpRequest): Promise<Principal | undefined> | Principal | undefined {
    const userId = req.getHeaderFirst('USER_ID');
    if (userId) {
      let p: Principal | undefined;
      // Lookup user from db, remote system, etc.,
      return p;
    }
    return;
  }
  encode(payload: HttpPayload, data: Principal | undefined): HttpPayload {
    if (data) {
      payload.setHeader('USER_ID', data.id);
    }
    return payload;
  }
}