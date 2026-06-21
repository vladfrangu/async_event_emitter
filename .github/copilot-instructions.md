# Async Event Emitter Library

This is a TypeScript library that provides an async-aware event emitter implementation. It's a lightweight alternative to Node.js's EventEmitter with built-in support for async/await patterns and Promise handling.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Setup
- Install dependencies: `yarn install --immutable`
  - Takes ~5-45 seconds depending on cache state. NEVER CANCEL.
  - Uses Yarn 4.3.1 (modern Yarn with PnP)
  - Requires Node.js >=14.0.0, recommended Node.js 20.15.0

### Development Workflow
- Type check code: `yarn typecheck`
  - Takes ~2 seconds. Fast TypeScript compilation check without output.
- Lint code: `yarn lint`
  - Takes ~3-4 seconds. Uses ESLint with TypeScript rules.
  - Auto-fixes issues when possible with `yarn lint --fix`
- Format code: `yarn format`
  - Takes ~1 second. Uses Prettier for consistent code formatting.
- Build library: `yarn build`
  - Takes ~5 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
  - Generates CJS (`dist/index.cjs`), ESM (`dist/index.mjs`), and UMD (`dist/index.global.js`) builds
  - Also generates TypeScript declaration files
- Run tests: `yarn test`
  - Takes ~2 seconds. Uses Vitest with coverage reporting.
  - Includes async iterator tests, coverage tests, and emitter functionality tests

### Full CI Pipeline
- Run complete validation: `yarn typecheck && yarn lint && yarn build && yarn test`
  - Takes ~12 seconds total. NEVER CANCEL. Set timeout to 60+ seconds.
  - This matches the GitHub Actions CI pipeline

### Documentation
- Generate API docs: `yarn docs`
  - Takes ~3 seconds. Uses TypeDoc to generate documentation in `./docs`

## Validation

- Always run the full CI pipeline (`yarn typecheck && yarn lint && yarn build && yarn test`) before committing changes.
- ALWAYS manually test async functionality when making changes to the core emitter logic.
- Test key functionality scenarios:
  - Basic event emission and listening
  - Async listener execution with `waitForAllListenersToComplete()`
  - Static methods like `AsyncEventEmitter.once()` and `AsyncEventEmitter.on()`
  - Error handling for unhandled errors
  - Memory leak detection with max listeners
- The library can be imported and tested directly from the built files in `dist/`
- Coverage should maintain reasonable levels (currently ~61% line coverage)

## Common Tasks

### Project Structure
```
src/
  index.ts           # Main library implementation (~1000 lines)
tests/
  emitter.test.ts    # Core emitter functionality tests
  async-iterator.test.ts  # AsyncGenerator tests
  coverage.test.ts   # Coverage and edge case tests
  manual.mjs         # Manual testing script
dist/                # Built output (generated)
  index.cjs          # CommonJS build
  index.mjs          # ESM build  
  index.global.js    # UMD build
  *.d.ts            # TypeScript declarations
```

### Package Scripts Reference
- `yarn install --immutable` - Install dependencies (5-45 seconds)
- `yarn typecheck` - TypeScript type checking (2 seconds)
- `yarn lint` - ESLint with auto-fix (3-4 seconds)
- `yarn format` - Prettier formatting (1 second)
- `yarn build` - Build all output formats (5 seconds)
- `yarn test` - Run test suite with coverage (2 seconds)
- `yarn docs` - Generate TypeDoc documentation (3 seconds)
- `yarn clean` - Remove built `dist/` directory
- `yarn update` - Interactive dependency updates

### Key Implementation Details
- The library extends standard EventEmitter patterns with async support
- `waitForAllListenersToComplete()` method allows waiting for all async listeners
- Automatic Promise tracking and error handling for async listeners
- TypeScript generics for type-safe event definitions
- Static methods `once()` and `on()` for Promise-based event handling
- AbortSignal support for cancellable operations
- Memory leak detection with max listeners warnings

### Testing Notes
- Tests use Vitest framework with coverage reporting
- Manual testing script available at `tests/manual.mjs`
- Test scenarios cover sync/async listeners, error handling, and memory management
- Expected console warning in tests about max listeners is normal behavior

### Build System
- Uses `tsup` for fast TypeScript bundling
- Generates multiple output formats (CJS, ESM, UMD)
- Source maps included for debugging
- TypeScript declaration files generated automatically
- Target: ES2020 with Node.js 14+ compatibility

### Important Warnings
- NEVER CANCEL any build or test commands - they complete quickly but may appear to hang briefly
- Always use `yarn install --immutable` in CI environments
- The library requires Node.js 14+ and works best with Node.js 20+
- Yarn 4.3.1 is required - do not use npm or older Yarn versions
- Some peer dependency warnings are expected and can be ignored