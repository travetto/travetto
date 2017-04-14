import Configuration from './config';
import { initStorage } from './context';
import { enableLongStacktrace } from './stack';

initStorage();

if (Configuration.longStackTraces) {
  enableLongStacktrace();
}
