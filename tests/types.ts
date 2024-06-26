import { AsyncEventEmitter, type GetAsyncEventEmitterEventParameters } from '../src';

declare const t: AsyncEventEmitter<{
	foo: [bar: string];
	newListener: [boolean, number];
	baz: [owo: true, uwu: false];
}>;

type res = GetAsyncEventEmitterEventParameters<typeof t, 'newListener'>;
//   ^?

type res2 = GetAsyncEventEmitterEventParameters<typeof t, 'foo'>;
//   ^?

type res3 = GetAsyncEventEmitterEventParameters<typeof t, 'aaa'>;
//   ^?

t.addListener('foo', (bar) => {
	console.log(bar);
});

t.addListener('newListener', (...args) => {
	console.log(args);
});

t.addListener('unknown', (arg1: 1) => {});

{
	const res = t.listenerCount('newListener');
	//    ^?
}
{
	const listeners = t.listeners('newListener');
	//     ^?

	const l = t.listeners('foo');
	//    ^?

	const l2 = t.listeners('baz22');
	//    ^?
}
{
	const listeners = t.rawListeners('newListener');
	//    ^?

	const l = t.rawListeners('foo');
	//    ^?

	const l2 = t.rawListeners('baz22');
	//    ^?
}

{
	const listeners = t.eventNames();
	//     ^?
}

{
	t.emit('newListener', 'foo', () => {});

	t.emit('foo', 'bar');

	t.emit('baz', true, false);

	t.emit('mama mia', 'here we go again');
}

{
	const eventCount = AsyncEventEmitter.listenerCount(t, 'baz');

	AsyncEventEmitter.listenerCount(t, 'aaa');
}

{
	const oncePromise1 = AsyncEventEmitter.once(t, 'foo');

	const oncePromise2 = AsyncEventEmitter.once(t, 'newListener');

	const oncePromise3 = AsyncEventEmitter.once(t, 'bazzinga');

	void AsyncEventEmitter.once(t, 'removeListener');

	void AsyncEventEmitter.once(t, 'foo');
}

{
	const iterator1 = AsyncEventEmitter.on(t, 'newListener');

	const iterator2 = AsyncEventEmitter.on(t, 'foo');

	const iterator3 = AsyncEventEmitter.on(t, 'bazzinga');
}

{
	t.emit('woow', 'bar');
}

// ------------------------------------------------------------ //

declare const ee: AsyncEventEmitter;
{
	ee.on('newListener', (...args) => {});

	ee.emit('newListener', 'foo', (one: 1) => {});

	ee.on('who dis be', (a: boolean) => {});

	type huh = GetAsyncEventEmitterEventParameters<typeof ee, 'newListener'>;
	//   ^?

	const events = ee.eventNames();
	//    ^?
}

interface Events {
	foo: [bar: string];
	baz: [owo: true, uwu: false];
}

declare const t2: AsyncEventEmitter<Events>;

{
	const res = t2.listenerCount('newListener');
	//    ^?
}

{
	const listeners = t2.listeners('newListener');
	//     ^?

	const l = t2.listeners('baz');
	//    ^?
}
