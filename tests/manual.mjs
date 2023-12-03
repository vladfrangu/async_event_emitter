import { AsyncEventEmitter } from '../dist/index.mjs';

const emitter = new AsyncEventEmitter();

emitter.on('test', async () => {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	console.log('test');
});

emitter.on('test', console.log);

emitter.emit('test');

console.log(emitter);

await emitter.waitForAllListenersToComplete();

console.log('after wait', emitter);
