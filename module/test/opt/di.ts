const { init } = require('@encore2/di/bootstrap');
import { beforeAll } from '../src/';

// Initialize if needed
if (init) {
  beforeAll(init);
}