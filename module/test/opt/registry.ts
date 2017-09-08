const Registry = require('@encore2/registry/bootstrap');
import { beforeAll } from '../src/';

// Initialize if needed
if (Registry) {
  beforeAll(Registry.init.bind(Registry));
}