import Config from '../config';
import { ChangeListener, ChangeEvent, MongoOp } from '../model';
import { MongoService } from './mongo';

const MongoOplog = require('mongo-oplog');

export class MongoChangeService {

  private static opMap = { i: 'insert', u: 'update', d: 'delete' };
  private static listeners: ChangeListener[] = [];
  private static oplog: any = null;

  static registerChangeListeners(...listeners: ChangeListener[]) {
    MongoChangeService.listeners.push(...listeners);
    MongoService.getClient().then(() => MongoChangeService.initChangeListeners());
  }

  private static translateMongoOp(data: MongoOp): ChangeEvent | undefined {
    let op = (MongoChangeService.opMap as any)[data.op] as any;
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
    if (!!MongoChangeService.oplog) {
      return;
    }

    MongoChangeService.oplog = MongoOplog(MongoService.getUrl(), { ns: `${Config.schema}[.].*` });
    MongoChangeService.oplog.tail();
    MongoChangeService.oplog.on('op', (data: MongoOp) => {
      let ev = MongoChangeService.translateMongoOp(data);
      if (ev) {
        for (let listener of MongoChangeService.listeners) {
          listener.onChange(ev);
        }
      }
    });
  }
}