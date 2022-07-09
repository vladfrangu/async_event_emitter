import { AsyncEventEmitter } from '../src/index';

describe('AsyncEventEmitter', () => {
	const ee = new AsyncEventEmitter();

	afterAll(() => {
		ee.removeAllListeners();
	});

	test('awaitAllListenersToComplete properly waits for all listeners to execute', async () => {
		const fn = vi.fn();
		const longFn = vi.fn(async () => {
			await new Promise((res) => setTimeout(res, 100));
		});

		ee.on('test', fn);
		ee.on('test', longFn);

		const startTime = Date.now();
		ee.emit('test');

		// Ensure the promises are created
		expect(ee['_internalPromiseMap']).not.toStrictEqual(Object.create(null));
		// Ensure 2 promises are created (even if one of the listeners is sync)
		expect(Object.keys(ee['_internalPromiseMap'])).toHaveLength(2);

		await ee.waitForAllListenersToComplete();

		const endTime = Date.now();

		expect(fn).toHaveBeenCalled();
		expect(longFn).toHaveBeenCalled();
		expect(endTime - startTime).toBeGreaterThanOrEqual(100);

		// Ensure the promises were deleted
		expect(ee['_internalPromiseMap']).toStrictEqual(Object.create(null));
	});
});
