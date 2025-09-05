/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/dot-notation */
function validateListener(input: unknown): asserts input is (...args: unknown[]) => void {
	if (typeof input !== 'function') {
		throw new TypeError(`The listener argument must be a function. Received ${typeof input}`);
	}
}

function validateAbortSignal(input: unknown): asserts input is AbortSignal | undefined {
	// Only validate that the signal is a signal if its defined
	if (input && !(input instanceof AbortSignal)) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		throw new TypeError(`The signal option must be an AbortSignal. Received ${input}`);
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

interface InternalEventMap extends Array<Listener> {
	_hasWarnedAboutMaxListeners?: boolean;
}

type InternalGetAsyncEventEmitterEventParameters<
	EE extends AsyncEventEmitter<any>,
	EventName extends PropertyKey,
	Events extends Record<PropertyKey, unknown[]> = EE extends AsyncEventEmitter<infer Events> ? Events
	:	Record<PropertyKey, unknown[]>,
> =
	EventName extends keyof AsyncEventEmitterPredefinedEvents ?
		EventName extends keyof Events ?
			AsyncEventEmitterPredefinedEvents[EventName] | (Events & Record<PropertyKey, unknown[]>)[EventName]
		:	AsyncEventEmitterPredefinedEvents[EventName]
	: EventName extends keyof Events ? (Events & Record<PropertyKey, unknown[]>)[EventName]
	: any[];

export type GetAsyncEventEmitterEventParameters<
	EE extends AsyncEventEmitter<any>,
	EventName extends PropertyKey | keyof AsyncEventEmitterPredefinedEvents,
> = InternalGetAsyncEventEmitterEventParameters<EE, EventName>;

type InternalAsyncEventEmitterInternalListenerForEvent<
	EE extends AsyncEventEmitter<any>,
	EventName extends PropertyKey,
	Events extends Record<PropertyKey, unknown[]> = EE extends AsyncEventEmitter<infer Events> ? Events
	:	Record<PropertyKey, unknown[]>,
> =
	EventName extends keyof AsyncEventEmitterPredefinedEvents ?
		EventName extends keyof Events ?
			Listener<
				AsyncEventEmitterPredefinedEvents[EventName] | (Events & Record<PropertyKey, unknown[]>)[EventName]
			>
		:	Listener<AsyncEventEmitterPredefinedEvents[EventName]>
	: EventName extends keyof Events ? Listener<(Events & Record<PropertyKey, unknown[]>)[EventName]>
	: Listener<any[]>;

export type AsyncEventEmitterInternalListenerForEvent<
	EE extends AsyncEventEmitter<any>,
	EventName extends PropertyKey | keyof AsyncEventEmitterPredefinedEvents,
> = InternalAsyncEventEmitterInternalListenerForEvent<EE, EventName>;

export type AsyncEventEmitterListenerForEvent<
	EE extends AsyncEventEmitter<any>,
	EventName extends PropertyKey | keyof AsyncEventEmitterPredefinedEvents,
> = Exclude<AsyncEventEmitterInternalListenerForEvent<EE, EventName>['listener'], undefined>;

const brandSymbol = Symbol.for('async-event-emitter.ts-brand');

export class AsyncEventEmitter<Events extends {} = {}> {
	/**
	 * This field doesn't actually exist, it's just a way to make TS properly infer the events from classes that extend AsyncEventEmitter
	 */
	protected readonly [brandSymbol]!: Events;

	private _events: Record<string | symbol, Listener | InternalEventMap> = {
		__proto__: null,
	} as Record<keyof Events | keyof AsyncEventEmitterPredefinedEvents, Listener | InternalEventMap>;

	private _eventCount = 0;
	private _maxListeners = 10;
	private _internalPromiseMap: Map<string, Promise<void>> = new Map();
	private _wrapperId = 0n;

	public addListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public addListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public addListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		validateListener(listener);

		const wrapped = this._wrapListener(eventName, listener, false);

		this._addListener(eventName, wrapped, false);

		return this;
	}

	public on<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public on<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public on<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		return this.addListener(eventName, listener);
	}

	public once<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public once<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public once<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		validateListener(listener);

		const wrapped = this._wrapListener(eventName, listener, true);

		this._addListener(eventName, wrapped, false);

		return this;
	}

	public removeListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public removeListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public removeListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		validateListener(listener);

		const events = this._events;
		const eventList = events[eventName];

		if (eventList === undefined) {
			return this;
		}

		if (eventList === listener || (eventList as Listener).listener === listener) {
			if (--this._eventCount === 0) {
				this._events = { __proto__: null } as Record<
					keyof Events | keyof AsyncEventEmitterPredefinedEvents,
					Listener | InternalEventMap
				>;
			} else {
				delete events[eventName];
				if (events.removeListener) {
					this.emit(
						'removeListener',
						eventName as string,
						((eventList as Listener).listener ?? eventList) as (...args: any[]) => void,
					);
				}
			}
		} else if (typeof eventList !== 'function') {
			let position = -1;

			for (let i = eventList.length - 1; i >= 0; i--) {
				if (eventList[i] === listener || (eventList[i] as Listener).listener === listener) {
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
				delete events[eventName];
				--this._eventCount;
			}

			if (events.removeListener !== undefined) {
				this.emit('removeListener', eventName, listener);
			}
		}

		return this;
	}

	public off<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public off<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public off<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		return this.removeListener(eventName, listener);
	}

	public removeAllListeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(event: K): this;

	public removeAllListeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		event?: K | undefined,
	): this;

	public removeAllListeners(event: string | symbol): this;

	public removeAllListeners(event?: string | symbol | undefined): this;

	public removeAllListeners(event?: string | symbol | undefined): this {
		const events = this._events;

		// Not listening for removeListener, no need to emit
		if (events.removeListener === undefined) {
			if (!event) {
				this._events = { __proto__: null } as Record<
					keyof Events | keyof AsyncEventEmitterPredefinedEvents,
					InternalEventMap
				>;
				this._eventCount = 0;
			} else if (events[event] !== undefined) {
				if (--this._eventCount === 0) {
					this._events = { __proto__: null } as Record<
						keyof Events | keyof AsyncEventEmitterPredefinedEvents,
						InternalEventMap
					>;
				} else {
					delete events[event];
				}
			}

			return this;
		}

		// Emit removeListener for all listeners on all events
		if (!event) {
			for (const key of Reflect.ownKeys(events) as (keyof Events | keyof AsyncEventEmitterPredefinedEvents)[]) {
				if (key === 'removeListener') {
					continue;
				}
				this.removeAllListeners(key);
			}

			this.removeAllListeners('removeListener');
			this._events = { __proto__: null } as Record<
				keyof Events | keyof AsyncEventEmitterPredefinedEvents,
				InternalEventMap
			>;
			this._eventCount = 0;

			return this;
		}

		const listeners = events[event];

		if (typeof listeners === 'function') {
			this.removeListener(event, listeners as any);
		} else if (listeners !== undefined) {
			// LIFO order
			for (let i = listeners.length - 1; i >= 0; i--) {
				this.removeListener(event, listeners[i] as any);
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
		eventName: K,
	): AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>[];

	public listeners<K extends string | symbol>(
		eventName: K,
	): AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>[];

	public listeners<K extends string | symbol>(
		eventName: K,
	): AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>[] {
		const eventList = this._events[eventName];

		if (eventList === undefined) {
			return [];
		}

		if (typeof eventList === 'function') {
			return [eventList.listener ?? eventList] as AsyncEventEmitterListenerForEvent<
				AsyncEventEmitter<Events>,
				K
			>[];
		}

		const ret = arrayClone(eventList) as AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>[];

		for (let i = 0; i < ret.length; ++i) {
			const orig = (ret[i] as Listener).listener;
			if (typeof orig === 'function') {
				ret[i] = orig as AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>;
			}
		}

		return ret;
	}

	public rawListeners<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
	): AsyncEventEmitterInternalListenerForEvent<AsyncEventEmitter<Events>, K>[];

	public rawListeners<K extends string | symbol>(
		eventName: K,
	): AsyncEventEmitterInternalListenerForEvent<AsyncEventEmitter<Events>, K>[];

	public rawListeners<K extends string | symbol>(
		eventName: K,
	): AsyncEventEmitterInternalListenerForEvent<AsyncEventEmitter<Events>, K>[] {
		const eventList = this._events[eventName];

		if (eventList === undefined) {
			return [];
		}

		if (typeof eventList === 'function') {
			return [eventList] as AsyncEventEmitterInternalListenerForEvent<AsyncEventEmitter<Events>, K>[];
		}

		return arrayClone(eventList) as AsyncEventEmitterInternalListenerForEvent<AsyncEventEmitter<Events>, K>[];
	}

	public emit<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		...args: GetAsyncEventEmitterEventParameters<AsyncEventEmitter<Events>, K>
	): boolean;

	public emit<K extends string | symbol>(
		eventName: K,
		...args: GetAsyncEventEmitterEventParameters<AsyncEventEmitter<Events>, K>
	): boolean;

	public emit<K extends string | symbol>(
		eventName: K,
		...args: GetAsyncEventEmitterEventParameters<AsyncEventEmitter<Events>, K>
	): boolean {
		let doError = eventName === 'error';

		const events = this._events;
		if (events !== undefined) {
			doError = doError && events.error === undefined;
		} else if (!doError) {
			return false;
		}

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
						configurable: true,
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

		const handlers = events[eventName];

		if (handlers === undefined) {
			return false;
		}

		if (typeof handlers === 'function') {
			const result = handlers.apply(this, args);

			if (result !== undefined && result !== null && eventName !== 'error') {
				handleMaybeAsync(this, result);
			}
		} else {
			const len = handlers.length;
			const listeners = arrayClone(handlers as InternalEventMap);

			for (let i = 0; i < len; ++i) {
				// We call all listeners regardless of the result, as we already handle possible error emits in the wrapped func
				const result = listeners[i].apply(this, args);

				if (result !== undefined && result !== null && eventName !== 'error') {
					handleMaybeAsync(this, result);
				}
			}
		}

		return true;
	}

	public listenerCount<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(eventName: K): number;

	public listenerCount(eventName: string | symbol): number;

	public listenerCount(eventName: string | symbol): number {
		const events = this._events;

		if (events === undefined) {
			return 0;
		}

		const eventListeners = events[eventName];

		if (typeof eventListeners === 'function') {
			return 1;
		}

		return eventListeners?.length ?? 0;
	}

	public prependListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public prependListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public prependListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		validateListener(listener);

		const wrapped = this._wrapListener(eventName, listener, false);

		this._addListener(eventName, wrapped, true);

		return this;
	}

	public prependOnceListener<K extends keyof Events | keyof AsyncEventEmitterPredefinedEvents>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public prependOnceListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this;

	public prependOnceListener<K extends string | symbol>(
		eventName: K,
		listener: AsyncEventEmitterListenerForEvent<AsyncEventEmitter<Events>, K>,
	): this {
		validateListener(listener);

		const wrapped = this._wrapListener(eventName, listener, true);

		this._addListener(eventName, wrapped, true);

		return this;
	}

	public eventNames(): (string | symbol)[] & (keyof AsyncEventEmitterPredefinedEvents)[] & (keyof Events)[] {
		return this._eventCount > 0 ?
				(Reflect.ownKeys(this._events) as (string | symbol)[] &
					(keyof AsyncEventEmitterPredefinedEvents)[] &
					(keyof Events)[])
			:	[];
	}

	public async waitForAllListenersToComplete() {
		const promises = [...this._internalPromiseMap.values()];

		if (promises.length === 0) {
			return false;
		}

		await Promise.all(promises);

		return true;
	}

	private _addListener(eventName: PropertyKey, wrappedListener: Listener, prepend: boolean) {
		// Emit newListener first in the event someone is listening for it
		if (this._events.newListener !== undefined) {
			// Thanks TypeScript for the cast... now with more what the fuck
			this.emit(
				'newListener',
				eventName as string | symbol,
				((wrappedListener as Listener).listener ?? wrappedListener) as (...args: any[]) => void,
			);
		}

		let existing = this._events[eventName];

		if (existing === undefined) {
			// eslint-disable-next-line no-multi-assign
			existing = this._events[eventName] = wrappedListener;
			++this._eventCount;
		} else if (typeof existing === 'function') {
			// Adding the second element, need to change to array.
			// eslint-disable-next-line no-multi-assign
			existing = this._events[eventName] = prepend ? [wrappedListener, existing] : [existing, wrappedListener];
			// If we've already got an array, just append.
		} else if (prepend) {
			existing.unshift(wrappedListener);
		} else {
			existing.push(wrappedListener);
		}

		const existingWarnedAboutMaxListeners = Reflect.get(existing, '_hasWarnedAboutMaxListeners') as boolean;

		if (this._maxListeners > 0 && existing.length > this._maxListeners && !existingWarnedAboutMaxListeners) {
			Reflect.set(existing, '_hasWarnedAboutMaxListeners', true);
			const warningMessage = [
				`Possible AsyncEventEmitter memory leak detected. ${existing.length} ${String(
					eventName,
				)} listeners added to ${this.constructor.name}.`,
				`Use emitter.setMaxListeners() to increase the limit.`,
			].join(' ');
			console.warn(warningMessage);
		}
	}

	private _wrapListener(eventName: PropertyKey, listener: (...args: any[]) => void, once: boolean): Listener {
		if (!once) {
			return listener as Listener;
		}

		const state = {
			fired: false,
			wrapFn: undefined!,
			eventEmitter: this,
			eventName,
			listener,
		} as WrappedOnceState<any[]>;

		const aliased = onceWrapper<any[]>;

		const wrapped = aliased.bind(state) as Listener<any[]>;
		wrapped.listener = listener as Listener<any[]>;
		state.wrapFn = wrapped;

		return wrapped as Listener;
	}

	public static listenerCount<
		EventMap extends {},
		EventName extends PropertyKey = keyof EventMap | keyof AsyncEventEmitterPredefinedEvents,
	>(emitter: AsyncEventEmitter<EventMap>, eventName: EventName | keyof AsyncEventEmitterPredefinedEvents): number;

	public static listenerCount(emitter: AsyncEventEmitter<any>, eventName: string | symbol): number;

	public static listenerCount(emitter: AsyncEventEmitter<any>, eventName: string | symbol) {
		return emitter.listenerCount(eventName);
	}

	public static async once<
		EventMap extends {},
		EventName extends PropertyKey = keyof EventMap | keyof AsyncEventEmitterPredefinedEvents,
	>(
		emitter: AsyncEventEmitter<EventMap>,
		eventName: EventName,
		options?: AbortableMethods,
	): Promise<GetAsyncEventEmitterEventParameters<AsyncEventEmitter<EventMap>, EventName>>;

	public static async once(
		emitter: AsyncEventEmitter<any>,
		eventName: string | symbol,
		options?: AbortableMethods,
	): Promise<any[]>;

	public static async once(
		emitter: AsyncEventEmitter<any>,
		eventName: string | symbol,
		options: AbortableMethods = {},
	) {
		const signal = options?.signal;
		validateAbortSignal(signal);

		if (signal?.aborted) {
			throw new AbortError(undefined, { cause: getReason(signal) });
		}

		return new Promise<any[]>((resolve, reject) => {
			const errorListener = (err: unknown) => {
				emitter.removeListener(eventName, resolver);

				if (signal) {
					eventTargetAgnosticRemoveListener(emitter, eventName, abortListener);
				}

				reject(err);
			};

			const resolver = (...args: any[]) => {
				emitter.removeListener('error', errorListener);

				if (signal) {
					eventTargetAgnosticRemoveListener(signal, 'abort', abortListener);
				}

				resolve(args as any[]);
			};

			emitter.once(eventName, resolver);
			if (eventName !== 'error') {
				emitter.once('error', errorListener);
			}

			const abortListener = () => {
				eventTargetAgnosticRemoveListener(emitter, eventName, resolver);
				eventTargetAgnosticRemoveListener(emitter, 'error', errorListener);
				reject(new AbortError(undefined, { cause: getReason(signal) }));
			};

			if (signal) {
				eventTargetAgnosticAddListener(signal, 'abort', abortListener, { once: true });
			}
		});
	}

	public static on<
		EventMap extends {},
		EventName extends PropertyKey = keyof EventMap | keyof AsyncEventEmitterPredefinedEvents,
	>(
		emitter: AsyncEventEmitter<EventMap>,
		eventName: EventName,
		options?: AbortableMethods,
	): AsyncGenerator<GetAsyncEventEmitterEventParameters<AsyncEventEmitter<EventMap>, EventName>, void>;

	public static on(
		emitter: AsyncEventEmitter<any>,
		eventName: string | symbol,
		options?: AbortableMethods,
	): AsyncGenerator<any[], void>;

	public static on(
		emitter: AsyncEventEmitter<any>,
		eventName: string | symbol,
		options: AbortableMethods = {},
	): AsyncGenerator<any[], void> {
		const signal = options?.signal;
		validateAbortSignal(signal);

		if (signal?.aborted) {
			throw new AbortError(undefined, { cause: getReason(signal) });
		}

		const unconsumedEvents: unknown[][] = [];
		const unconsumedPromises: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }[] = [];
		let error: unknown = null;
		let finished = false;

		const abortListener = () => {
			errorHandler(new AbortError(undefined, { cause: getReason(signal) }));
		};

		const eventHandler = (...args: unknown[]) => {
			const promise = unconsumedPromises.shift();
			if (promise) {
				promise.resolve(createIterResult(args, false));
			} else {
				unconsumedEvents.push(args);
			}
		};

		const errorHandler = (err: unknown) => {
			finished = true;

			const toError = unconsumedPromises.shift();

			if (toError) {
				toError.reject(err);
			} else {
				error = err;
			}

			void iterator.return();
		};

		const iterator: AsyncGenerator<any[], void> = Object.setPrototypeOf(
			{
				next() {
					// First, we consume all unread events
					const value = unconsumedEvents.shift();
					if (value) {
						return Promise.resolve(createIterResult(value, false));
					}

					// Then we error, if an error happened
					// This happens one time if at all, because after 'error'
					// we stop listening
					if (error) {
						const p = Promise.reject(error);
						// Only the first element errors
						error = null;
						return p;
					}

					// If the iterator is finished, resolve to done
					if (finished) {
						return Promise.resolve(createIterResult(undefined, true));
					}

					// Wait until an event happens
					return new Promise((resolve, reject) => {
						unconsumedPromises.push({ resolve, reject });
					});
				},

				return() {
					emitter.off(eventName, eventHandler);
					emitter.off('error', errorHandler);

					if (signal) {
						eventTargetAgnosticRemoveListener(signal, 'abort', abortListener);
					}

					finished = true;

					const doneResult = createIterResult(undefined, true);
					for (const promise of unconsumedPromises) {
						promise.resolve(doneResult);
					}

					return Promise.resolve(doneResult);
				},

				throw(err: unknown) {
					if (!err || !(err instanceof Error)) {
						throw new TypeError(
							`Expected Error instance to be thrown in AsyncEventEmitter.AsyncIterator. Got ${err}`,
						);
					}

					error = err;
					emitter.off(eventName, eventHandler);
					emitter.off('error', errorHandler);
				},

				[Symbol.asyncIterator]() {
					return this;
				},
			},
			AsyncIteratorPrototype,
		);

		emitter.on(eventName, eventHandler);
		if (eventName !== 'error') {
			emitter.on('error', errorHandler);
		}

		if (signal) {
			eventTargetAgnosticAddListener(signal, 'abort', abortListener);
		}

		return iterator;
	}
}

export interface AsyncEventEmitterPredefinedEvents {
	newListener: [eventName: string | symbol, listener: (...args: any[]) => void];
	removeListener: [eventName: string | symbol, listener: (...args: any[]) => void];
	error: [error: any];
}

interface WrappedOnceState<Args extends unknown[] = unknown[]> {
	listener: (...args: Args) => void;
	fired: boolean;
	eventName: string | symbol;
	eventEmitter: AsyncEventEmitter<any>;
	wrapFn: (...args: Args) => void;
}

export interface Listener<Args extends any[] = any[]> {
	(...args: Args): void;
	listener?: (...args: Args) => void;
	// _hasWarnedAboutMaxListeners?: boolean;
}

export interface AbortableMethods {
	signal?: AbortSignal;
}

// @ts-ignore Not all paths returning is fine just fine:tm:
function onceWrapper<Args extends any[] = any[]>(this: WrappedOnceState<Args>) {
	if (!this.fired) {
		this.eventEmitter.removeListener(this.eventName, this.wrapFn);
		this.fired = true;
		// eslint-disable-next-line @typescript-eslint/dot-notation
		if (arguments.length === 0) {
			// @ts-expect-error Types can be hell
			return this.listener.call(this.eventEmitter);
		}

		// eslint-disable-next-line prefer-rest-params
		return this.listener.apply(this.eventEmitter, arguments as unknown as Args);
	}
}

/**
 * A TypeScript not-compliant way of accessing AbortSignal#reason
 * Because DOM types have it, NodeJS types don't. -w-
 */
function getReason(signal: any) {
	return signal?.reason;
}

function eventTargetAgnosticRemoveListener(
	emitter: any,
	name: PropertyKey,
	listener: (...args: unknown[]) => any,
	flags?: InternalAgnosticFlags,
) {
	if (typeof emitter.off === 'function') {
		emitter.off(name, listener);
	} else if (typeof emitter.removeEventListener === 'function') {
		emitter.removeEventListener(name, listener, flags);
	}
}

function eventTargetAgnosticAddListener(
	emitter: any,
	name: string | symbol,
	listener: (...args: unknown[]) => any,
	flags?: InternalAgnosticFlags,
) {
	if (typeof emitter.on === 'function') {
		if (flags?.once) {
			emitter.once!(name, listener);
		} else {
			emitter.on(name, listener);
		}
	} else if (typeof emitter.addEventListener === 'function') {
		emitter.addEventListener(name, listener, flags);
	}
}

interface InternalAgnosticFlags {
	once?: boolean;
}

// eslint-disable-next-line func-names, @typescript-eslint/no-empty-function
const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);

function createIterResult(value: unknown, done: boolean) {
	return { value, done };
}

export interface AbortErrorOptions {
	cause?: unknown;
}

export class AbortError extends Error {
	public readonly code = 'ABORT_ERR';
	public override readonly name = 'AbortError';

	public constructor(message = 'The operation was aborted', options: AbortErrorOptions | undefined = undefined) {
		if (options !== undefined && typeof options !== 'object') {
			throw new TypeError(`Failed to create AbortError: options is not an object or undefined`);
		}

		super(message, options);
	}
}

function handleMaybeAsync(emitter: AsyncEventEmitter<any>, result: any) {
	try {
		const catchMethod = result.catch;
		const fin = result.finally;

		// First, handle promise rejections with .catch()
		if (typeof catchMethod === 'function') {
			const handledPromise = catchMethod.call(result, (error: any) => {
				// Emit error event synchronously to avoid unhandled promise rejection
				emitter.emit('error', error);
				// Return undefined to resolve the catch promise
				return undefined;
			});
			
			// Use the handled promise for tracking instead of the original
			if (typeof fin === 'function') {
				const promiseId = String(++emitter['_wrapperId']);
				emitter['_internalPromiseMap'].set(promiseId, handledPromise);
				fin.call(handledPromise, function final() {
					emitter['_internalPromiseMap'].delete(promiseId);
				});
			}
		} else {
			// Fallback for promise-like objects without .catch()
			const the = result.then;
			if (typeof the === 'function') {
				const handledPromise = the.call(result, 
					() => {
						// Promise resolved successfully, nothing to do
					}, 
					(error: any) => {
						// Emit error event synchronously
						emitter.emit('error', error);
					}
				);
				
				// Use the handled promise for tracking
				if (typeof fin === 'function') {
					const promiseId = String(++emitter['_wrapperId']);
					emitter['_internalPromiseMap'].set(promiseId, handledPromise);
					fin.call(handledPromise, function final() {
						emitter['_internalPromiseMap'].delete(promiseId);
					});
				}
			}
		}
	} catch (err) {
		emitter.emit('error', err);
	}
}
