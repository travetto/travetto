import { Ready } from '@encore/init';
import { beforeAll } from '@encore/test';
import { MongoService } from '@encore/mongo';

beforeAll(async () => {
  await Ready.onReadyPromise();
  await MongoService.resetDatabase();
});