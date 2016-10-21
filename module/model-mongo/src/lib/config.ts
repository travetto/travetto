import { registerNamespace } from '@encore/init';
export default registerNamespace('mongo', {
	host: "localhost",
	schema: "app",
	port: 27017
});