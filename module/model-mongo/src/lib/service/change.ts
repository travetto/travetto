import Config from '../config';
import { ChangeListener, ChangeEvent, MongoOp } from '../model';
import { MongoService } from './mongo';

const MongoOplog = require('mongo-oplog');

export class ChangeService {

  private static opMap = { i: 'insert', u: 'update', d: 'delete' };
  private static listeners: ChangeListener[] = [];
  private static oplog: any = null;

  static registerChangeListeners(...listeners: ChangeListener[]) {
    ChangeService.listeners.push(...listeners);
    MongoService.getClient().then(() => ChangeService.initChangeListeners());
  }

  private static translateMongoOp(data: MongoOp): ChangeEvent | undefined {
    let op = (ChangeService.opMap as any)[data.op] as any;
    if (op && data.ns) {
      let ev: ChangeEvent = {
        timestamp: data.ts,
        collection: data.ns.substring(data.ns.indexOf('.') + 1),
        operation: op,
        version: data.v,
        document: data.o,
      }
      return ev;
    }
  }

  static async initChangeListeners() {
    if (!!ChangeService.oplog) {
      return;
    }

    ChangeService.oplog = MongoOplog(MongoService.getUrl(), { ns: `${Config.schema}[.].*` });
    ChangeService.oplog.tail();
    ChangeService.oplog.on('op', (data: MongoOp) => {
      let ev = ChangeService.translateMongoOp(data);
      if (ev) {
        for (let listener of ChangeService.listeners) {
          listener(ev);
        }
      }
    });
  }
}