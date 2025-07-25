import type { ServiceDescriptor } from '@travetto/cli';

const version = '9.0.2';

const port = 9200;

export const service: ServiceDescriptor = {
  name: 'elasticsearch',
  version,
  port,
  env: {
    'discovery.type': 'single-node',
    'action.destructive_requires_name': 'false',
    'xpack.security.enabled': 'false',
    'xpack.ml.enabled': 'false',
    'xpack.graph.enabled': 'false',
    'xpack.watcher.enabled': 'false',
    ES_JAVA_OPTS: '-Xms256m -Xmx256m'
  },
  ready: { url: `http://localhost:${port}/_cluster/health`, test: b => b.includes('"status":"green"') },
  image: `docker.elastic.co/elasticsearch/elasticsearch:${version}`,
  startupTimeout: 15000
};