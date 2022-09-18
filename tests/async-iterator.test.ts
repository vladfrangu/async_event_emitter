import { AsyncEventEmitter } from '../src';

describe('AsyncEventEmitter.on', () => {
	const ee = new AsyncEventEmitter<{ test: [number] }>();

	afterAll(() => {
		ee.removeAllListeners();
	});

	test('using "on" should return an iterator that can be consumed', async () => {
		const iterator = AsyncEventEmitter.on(ee, 'test');

		ee.emit('test', 1);
		ee.emit('test', 2);
		setTimeout(() => {
			ee.emit('test', 3);
			ee.emit('test', 4);
			ee.emit('test', 5);
		}, 25);

		const received = [];

		for await (const [number] of iterator) {
			received.push(number);

			if (number > 3) {
				break;
			}
		}

		expect(received).toHaveLength(4);
		expect(received).toStrictEqual([1, 2, 3, 4]);
		expect(ee.listenerCount('test')).toEqual(0);
	});
});
