import { describe, expect, test, vi } from 'vitest';
import { AsyncEventEmitter } from '../src/index';

describe('AsyncEventEmitter Error Handling', () => {
	test('should emit error event when async listener throws', async () => {
		const ee = new AsyncEventEmitter();
		const errorHandler = vi.fn();

		// Add error event listener
		ee.on('error', errorHandler);

		// Add async test listener that throws
		// eslint-disable-next-line @typescript-eslint/require-await
		ee.on('test', async (_data) => {
			throw new Error('Test error from async handler');
		});

		// Emit test event
		ee.emit('test', { hello: 'world' });

		// Wait for async operation to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Check that error event was emitted
		expect(errorHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Test error from async handler',
			}),
		);
	});

	test('should emit error event when promise-returning listener rejects', async () => {
		const ee = new AsyncEventEmitter();
		const errorHandler = vi.fn();

		// Add error event listener
		ee.on('error', errorHandler);

		// Add listener that returns rejected promise
		ee.on('test', () => {
			return Promise.reject(new Error('Test error from rejected promise'));
		});

		// Emit test event
		ee.emit('test', { hello: 'world' });

		// Wait for async operation to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Check that error event was emitted
		expect(errorHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Test error from rejected promise',
			}),
		);
	});
});
