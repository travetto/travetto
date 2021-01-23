const version = '3.6';

export const service = {
  name: 'mongodb',
  version,
  port: 27017,
  image: `mongo:${version}`
};