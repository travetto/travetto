import { beforeAll } from '../src/';
import { init } from '@encore/di/bootstrap';

//Initialize if needed
if (init) {
  beforeAll(init);
}