import { v4 } from 'uuid';

function validateListener(input: unknown): asserts input is (...args: unknown[]) => Awaitable<void> {
	if (typeof input !== 'function') {
		throw new TypeError(`The listener argument must be a function. Received ${typeof input}`);
	}
}

// Inspired from https://github.com/nodejs/node/blob/42ad967d68137df1a80a877e7b5ad56403fc157f/lib/internal/util.js#L397
function spliceOne(list: unknown[], index: number) {
	for (; index + 1 < list.length; index++) {
		list[index] = list[index + 1];
	}

	list.pop();
}

// Inspired from https://github.com/nodejs/node/blob/42ad967d68137df1a80a877e7b5ad56403fc157f/lib/events.js#L889
function arrayClone<T extends unknown[]>(arr: T): T {
	// At least since V8 8.3, this implementation is faster than the previous
	// which always used a simple for-loop
	switch (arr.length) {
		case 2:
			return [arr[0], arr[1]] as T;
		case 3:
			return [arr[0], arr[1], arr[2]] as T;
		case 4:
			return [arr[0], arr[1], arr[2], arr[3]] as T;
		case 5:
			return [arr[0], arr[1], arr[2], arr[3], arr[4]] as T;
		case 6:
			return [arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]] as T;
	}

	return arr.slice() as T;
}

// Inspired from https://github.com/nodejs/node/blob/42ad967d68137df1a80a877e7b5ad56403fc157f/lib/events.js#L427-L475
function identicalSequenceRange(a: unknown[], b: unknown[]): [number, number] {
	for (let i = 0; i < a.length - 3; i++) {
		// Find the first entry of b that matches the current entry of a.
		const pos = b.indexOf(a[i]);
		if (pos !== -1) {
			const rest = b.length - pos;
			if (rest > 3) {
				let len = 1;
				const maxLen = Math.min(a.length - i, rest);
				// Count the number of consecutive entries.
				while (maxLen > len && a[i + len] === b[pos + len]) {
					len++;
				}
				if (len > 3) {
					return [len, i];
				}
			}
		}
	}

	return [0, 0];
}

function enhanceStackTrace(this: AsyncEventEmitter<any>, err: Error, own: Error) {
	let ctorInfo = '';
	try {
		const { name } = this.constructor;
		if (name !== 'AsyncEventEmitter') ctorInfo = ` on ${name} instance`;
	} catch {
		// Continue regardless of error.
	}
	const sep = `\nEmitted 'error' event${ctorInfo} at:\n`;

	const errStack = err.stack!.split('\n').slice(1);
	const ownStack = own.stack!.split('\n').slice(1);

	const { 0: len, 1: off } = identicalSequenceRange(ownStack, errStack);
	if (len > 0) {
		ownStack.splice(off + 1, len - 2, '    [... lines matching original stack trace ...]');
	}

	return err.stack + sep + ownStack.join('\n');
}

interface InternalEventMap extends Array<StoredListener> {
	_hasWarnedAboutMaxListeners?: boolean;
}

export class AsyncEventEmitter<
	Events extends Record<string | symbol, unknown[]> = Record<string | symbol, unknown[]> & AsyncEventEmitterPredefinedEvents
> {
	private _events: Record<keyof Events | keyof AsyncEventEmitterPredefinedEvents, InternalEventMap> = Object.create(null);
	private _eventCount = 0;
	private _maxListeners = 10;
	private _internalPromiseMap: Record<string, Promise<void>> = Object.create(null);

	public addListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		validateListener(listener);

		const wrapped = this.#_wrapListener(eventName, listener, false);

		this.#_addListener(eventName, wrapped, false);

		return this;
	}

	public on<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		return this.addListener(eventName, listener);
	}

	public once<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		validateListener(listener);

		const wrapped = this.#_wrapListener(eventName, listener, true);

		this.#_addListener(eventName, wrapped, false);

		return this;
	}

	public removeListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		validateListener(listener);

		const eventList = this._events[eventName];

		if (eventList === undefined) {
			return this;
		}

		let position = -1;

		for (let i = eventList.length - 1; i >= 0; i--) {
			if (eventList[i].listener === listener) {
				position = i;
				break;
			}
		}

		if (position < 0) {
			return this;
		}

		if (position === 0) {
			eventList.shift();
		} else {
			spliceOne(eventList, position);
		}

		if (eventList.length === 0) {
			delete this._events[eventName];
			--this._eventCount;
		}

		if (this._events.removeListener !== undefined) {
			// Thanks TypeScript for the cast...
			this.emit('removeListener', eventName as string | symbol, listener);
		}

		return this;
	}

	public off<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		return this.removeListener(eventName, listener);
	}

	public removeAllListeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(event?: K | undefined): this {
		// Not listening for removeListener, no need to emit
		if (this._events.removeListener === undefined) {
			if (!event) {
				this._events = Object.create(null);
			} else if (this._events[event] !== undefined) {
				if (--this._eventCount === 0) {
					this._events = Object.create(null);
				} else {
					delete this._events[event];
				}
			}

			return this;
		}

		// Emit removeListener for all listeners on all events
		if (!event) {
			for (const key of Reflect.ownKeys(this._events)) {
				if (key === 'removeListener') {
					continue;
				}
				this.removeAllListeners(key);
			}

			this.removeAllListeners('removeListener');
			this._events = Object.create(null);
			this._eventCount = 0;

			return this;
		}

		const listeners = this._events[event];

		if (listeners !== undefined) {
			// LIFO order
			for (let i = listeners.length - 1; i >= 0; i--) {
				this.removeListener(event, listeners[i].listener);
			}
		}

		return this;
	}

	public setMaxListeners(n: number): this {
		if (typeof n !== 'number' || n < 0 || Number.isNaN(n)) {
			throw new RangeError(`Expected to get a non-negative number for "setMaxListeners", got ${n} instead`);
		}

		this._maxListeners = n;

		return this;
	}

	public getMaxListeners(): number {
		return this._maxListeners;
	}

	public listeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K
	): StoredListener<Events[keyof Events]>['listener'][] {
		const eventList = this._events[eventName];

		if (eventList === undefined) {
			return [];
		}

		return eventList.map(({ listener }) => listener);
	}

	public rawListeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(eventName: K): StoredListener<Events[keyof Events]>[] {
		const eventList = this._events[eventName];

		if (eventList === undefined) {
			return [];
		}

		return arrayClone(eventList);
	}

	public emit<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]
	): boolean {
		const doError = eventName === 'error' && this._events.error === undefined;

		if (doError) {
			let er: unknown;

			if (args.length > 0) {
				// eslint-disable-next-line prefer-destructuring
				er = args[0];
			}

			if (er instanceof Error) {
				try {
					const capture = {};
					// eslint-disable-next-line @typescript-eslint/unbound-method
					Error.captureStackTrace(capture, AsyncEventEmitter.prototype.emit);
					Object.defineProperty(er, 'stack', {
						value: enhanceStackTrace.call(this, er, capture as Error),
						configurable: true
					});
				} catch {
					// Continue regardless of error
				}

				throw er; // Unhandled 'error' event
			}

			const stringifiedError = String(er);

			// Give some error to user
			const err = new Error(`Unhandled 'error' event emitted, received ${stringifiedError}`);
			// @ts-expect-error Add context to error too
			err.context = er;

			throw err; // Unhandled 'error' event
		}

		const handlers = this._events[eventName];

		if (handlers === undefined) {
			return false;
		}

		const len = handlers.length;
		const listeners = arrayClone(handlers);

		for (let i = 0; i < len; ++i) {
			// We call all listeners regardless of the result, as we already handle possible error emits in the wrapped func
			void listeners[i].wrappedFunc(...args);
		}

		return true;
	}

	public listenerCount<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(eventName: K): number {
		return this._eventCount > 0 ? this._events[eventName]?.length ?? 0 : 0;
	}

	public prependListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		validateListener(listener);

		const wrapped = this.#_wrapListener(eventName, listener, false);

		this.#_addListener(eventName, wrapped, true);

		return this;
	}

	public prependOnceListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void
	): this {
		validateListener(listener);

		const wrapped = this.#_wrapListener(eventName, listener, true);

		this.#_addListener(eventName, wrapped, true);

		return this;
	}

	public eventNames(): (keyof Events | keyof AsyncEventEmitterPredefinedEvents)[] {
		return this._eventCount > 0 ? Reflect.ownKeys(this._events) : [];
	}

	public async awaitAllListenersToComplete() {
		const promises = Object.values(this._internalPromiseMap);

		if (promises.length === 0) {
			return false;
		}

		await Promise.all(promises);

		return true;
	}

	#_addListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(eventName: K, wrappedListener: StoredListener, prepend: boolean) {
		// Emit newListener first in the event someone is listening for it
		if (this._events.newListener !== undefined) {
			// Thanks TypeScript for the cast...
			this.emit('newListener', eventName as string | symbol, wrappedListener.listener);
		}

		let existing = this._events[eventName];

		if (existing === undefined) {
			// eslint-disable-next-line no-multi-assign
			existing = this._events[eventName] = [wrappedListener];
			this._eventCount++;
		} else if (prepend) {
			existing.unshift(wrappedListener);
		} else {
			existing.push(wrappedListener);
		}

		if (this._maxListeners > 0 && existing.length > this._maxListeners && !existing._hasWarnedAboutMaxListeners) {
			existing._hasWarnedAboutMaxListeners = true;
			const warningMessage = [
				`Possible AsyncEventEmitter memory leak detected. ${existing.length} ${String(eventName)} listeners added to ${
					this.constructor.name
				}.`,
				`Use emitter.setMaxListeners() to increase the limit.`
			].join(' ');
			console.warn(warningMessage, this);
		}
	}

	#_wrapListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: (...args: K extends keyof AsyncEventEmitterPredefinedEvents ? AsyncEventEmitterPredefinedEvents[K] : Events[K]) => void,
		once: boolean
	) {
		const state = {
			fired: false,
			listener,
			target: this,
			once
		} as unknown as StoredListener;

		const wrappedFn = async (...args: any[]) => {
			if (state.once && state.fired) {
				// Prevent execution if this listener is meant to be ran only once and it was already ran
				return;
			}

			// Remove the listener to prevent subsequent executions
			if (state.once) {
				state.fired = true;
				state.eventEmitter.removeListener(eventName, listener);
			}

			const promiseUuid = v4();

			const promise = new Promise<void>(async (res) => {
				try {
					// Execute the actual listener
					if (args.length === 0) {
						await state.listener.call(this);
					} else {
						await state.listener.apply(this, args);
					}
				} catch (err) {
					// Emit the error event
					state.eventEmitter.emit('error', err);
				} finally {
					// Resolve the internal promise
					res();

					delete this._internalPromiseMap[promiseUuid];
				}
			});

			this._internalPromiseMap[promiseUuid] = promise;

			await promise;
		};

		state.wrappedFunc = wrappedFn;

		return state;
	}
}

export interface AsyncEventEmitterPredefinedEvents {
	newListener: [eventName: string | symbol, listener: (...args: any[]) => Awaitable<void>];
	removeListener: [eventName: string | symbol, listener: (...args: any[]) => Awaitable<void>];
	error: [error: unknown];
}

export interface StoredListener<Args extends any[] = any[]> {
	wrappedFunc: (...args: Args) => Promise<void>;
	listener: (...args: Args) => Awaitable<void>;
	fired: boolean;
	once: boolean;
	eventName: string | symbol;
	eventEmitter: AsyncEventEmitter<any>;
}

export type Awaitable<T> = T | Promise<T>;
