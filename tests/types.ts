import {
	AsyncEventEmitter,
	type AsyncEventEmitterListenerForEvent,
	type GetAsyncEventEmitterEventParameters,
} from '../src';

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

	t.emit('newListener', {});

	t.emit('foo', 'bar');

	t.emit('foo', true);

	t.emit('baz', true, false);

	t.emit('mama mia', 'here we go again');
}

{
	const bound = t.emit.bind(t, 'newListener');
}

{
	const listener: AsyncEventEmitterListenerForEvent<typeof t, 'foo'> = (bar) => {
		console.log(bar);
	};

	const listener2: AsyncEventEmitterListenerForEvent<typeof t, 'newListener'> = (...args) => {
		console.log(args);
	};

	t.removeListener('foo', listener);

	t.removeListener('foo', listener2);
}

{
	const eventCount = AsyncEventEmitter.listenerCount(t, 'baz');

	AsyncEventEmitter.listenerCount(t, 'aaa');
}

{
	const oncePromise1 = AsyncEventEmitter.once(t, 'foo');

	const oncePromise1_1 = AsyncEventEmitter.once(t, 'foo', {});

	const oncePromise2 = AsyncEventEmitter.once(t, 'newListener');

	const oncePromise3 = AsyncEventEmitter.once(t, 'bazzinga');

	void AsyncEventEmitter.once(t, 'removeListener');

	void AsyncEventEmitter.once(t, 'foo');

	void AsyncEventEmitter.once(t, 'no dice');
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

	events.includes('owo');
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

enum EventsEnum {
	Test1 = 'test1',
}

interface Events2 {
	[EventsEnum.Test1]: [bar: string];
}

declare const emitterWithEnum: AsyncEventEmitter<Events2>;

emitterWithEnum.on(EventsEnum.Test1, (bar) => {
	console.log(bar);
});

class Extension extends AsyncEventEmitter<Events2> {
	public emitCustom() {
		// this.emit();

		// this.on();

		this.emit(EventsEnum.Test1, 123);
	}

	public async selfIterate() {
		const iterator = AsyncEventEmitter.on(this, EventsEnum.Test1);

		for await (const [bar] of iterator) {
			console.log(bar);
		}
	}
}

declare const extended: Extension;

{
	const promise1 = AsyncEventEmitter.once(extended, EventsEnum.Test1);
}
