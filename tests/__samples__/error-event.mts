import { AsyncEventEmitter } from '../../src/index.ts';

const aee = new AsyncEventEmitter();

aee.on('test', async (data) => {
	console.log(data);
	throw new Error('Test error');
});

aee.on('test2', async () => {
	throw { foo: 'bar' };
});

// aee.on('error', (err) => {
// 	console.error('Error event:', err); // Not emitted.
// });

// aee.emit('test', { hello: 'world' });
aee.emit('test2', { hello: 'world' });
