import { version } from '@elastic/elasticsearch/package.json';

export const service = {
  name: 'elasticsearch',
  version,
  port: 9200,
  env: {
    'discovery.type': 'single-node'
  },
  image: `docker.elastic.co/elasticsearch/elasticsearch:${version}`
};