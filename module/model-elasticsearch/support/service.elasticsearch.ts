import type { Service } from '@travetto/command/bin/lib/service';
import { version } from '@elastic/elasticsearch/package.json';

const port = 9200;

export const service: Service = {
  name: 'elasticsearch',
  version,
  port,
  env: {
    'discovery.type': 'single-node',
    'xpack.security.enabled': 'false',
    'xpack.monitoring.enabled': 'false',
    'xpack.ml.enabled': 'false',
    'xpack.graph.enabled': 'false',
    'xpack.watcher.enabled': 'false',
    ES_JAVA_OPTS: '-Xms256m -Xmx256m'
  },
  ready: { url: `http://localhost:${port}/_cluster/health`, test: b => b.includes('"status":"green"') },
  image: `docker.elastic.co/elasticsearch/elasticsearch:${version}`
};