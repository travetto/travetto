import { Injectable, Inject } from '@travetto/di';
import { ModelService, Model } from '@travetto/model';

import { Session, SessionStore } from '..';

@Model()
export class SessionModel {
  id?: string;
  expiresAt?: Date;
  maxAge?: number;
  signature?: string;
  issuedAt: Date;
  payload?: any;
  payloadData?: string;
}

@Injectable({ target: ModelStore })
export class ModelStore extends SessionStore {

  @Inject()
  modelService: ModelService;

  async load(id: string) {
    const res = await this.modelService.getAllByQuery(SessionModel, { where: { id } });
    if (res.length === 1) {
      const out = res[0];
      if (out.payloadData && !out.payload) {
        try {
          out.payload = JSON.parse(out.payloadData);
        } catch (e) { }
      }
      if (out.payload) {
        return new Session(out);
      }
    }
  }
  async store(sess: Session) {
    const data = SessionModel.from(sess);
    data.payloadData = JSON.stringify(data.payload);
    delete data.payload;
    await this.modelService.saveOrUpdate(SessionModel, data, { where: { id: data.id }, keepId: true });
  }

  async destroy(session: Session) {
    return (await this.modelService.deleteById(SessionModel, session.id!)) > 0;
  }
}