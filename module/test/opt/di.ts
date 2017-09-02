const { init } = require('@encore/di/bootstrap');
import { beforeAll } from '../src/';

// Initialize if needed
if (init) {
  beforeAll(init);
}