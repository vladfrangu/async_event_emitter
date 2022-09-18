import { AsyncEventEmitter } from '../src';

describe('AsyncEventEmitter coverage', () => {
	const ee = new AsyncEventEmitter();

	afterEach(() => {
		ee.removeAllListeners();
		ee.setMaxListeners(10);
	});

	describe('on + addListener + prependListener', () => {
		test('"newListener" event is emitted when listening to an event and the user listens to "newListener"', () => {
			const newListenerFn = vi.fn();

			ee.on('newListener', newListenerFn);
			ee.on('test_1', vi.fn());

			expect(newListenerFn).toHaveBeenCalled();
		});

		test('calling "prependListener" should add the listener in the front', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			ee.on('test_2', listener2);
			ee.prependListener('test_2', listener1);

			expect(ee.listeners('test_2')).toStrictEqual([listener1, listener2]);
		});

		test('adding a listener that goes over the maxListeners property emits a console warning', () => {
			const consoleSpy = vi.spyOn(console, 'warn');

			ee.setMaxListeners(2);

			ee.on('test_3', vi.fn());
			ee.on('test_3', vi.fn());
			ee.on('test_3', vi.fn());

			expect(consoleSpy).toHaveBeenCalled();

			expect(ee['_events'].test_3._hasWarnedAboutMaxListeners).toBe(true);
		});
	});

	// TODO: eventually
});
