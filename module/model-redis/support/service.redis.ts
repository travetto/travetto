const version = 5;

export const service = {
  name: 'redis',
  version,
  port: 6379,
  image: `redis:${version}-alpine`
};