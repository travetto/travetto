import { Ready } from '@encore/lifecycle';
import { beforeAll } from '@encore/test';
import { MongoService } from '@encore/mongo';

beforeAll(async () => {
  await Ready.onReadyPromise();
  await MongoService.resetDatabase();
});