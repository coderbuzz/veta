<!-- docs: sync from coderbuzz/codex@b37bd48 -->

# Veta: `@coderbuzz/veta`

> Runtime-agnostic schema validation for TypeScript. Faster than Zod. Smaller than Yup. Type-safe where Joi isn't.
> AI agents: see [AI_KNOWLEDGE.md](https://github.com/coderbuzz/veta/blob/main/AI_KNOWLEDGE.md) for expert context.
<p align="center">
  <a href="https://www.npmjs.com/package/@coderbuzz/veta"><img src="https://img.shields.io/npm/v/@coderbuzz/veta.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@coderbuzz/veta"><img src="https://img.shields.io/npm/dm/@coderbuzz/veta.svg?style=flat-square" alt="npm downloads" /></a>
  <a href="https://github.com/coderbuzz/veta/blob/main/LICENSE"><img src="https://img.shields.io/github/license/coderbuzz/veta.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/coderbuzz/veta"><img src="https://img.shields.io/github/stars/coderbuzz/veta.svg?style=flat-square" alt="GitHub Stars" /></a>
  <a href="https://github.com/coderbuzz/veta/actions/workflows/ci.yml"><img src="https://github.com/coderbuzz/veta/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/coderbuzz/veta"><img src="https://codecov.io/gh/coderbuzz/veta/graph/badge.svg" alt="Codecov" /></a>
</p>

**Veta** is a schema validation library built for TypeScript ergonomics: zero dependencies, full type inference, built-in coercion, sync and async pipelines, context forwarding, and schema metadata for serialization, in a single package that runs on **Bun, Deno, and Node.js**.

---

## Why Veta over Zod, Yup, or Joi?

| Pain Point | Zod | Yup | Joi | **Veta** |
|---|---|---|---|---|
| Nested object syntax | Must wrap every level with `z.object()` | Same | Same | **Shorthand**: plain objects auto-detect |
| Type coercion | `z.coerce.xxx()` or custom transforms | `.cast()` only | Separate module | **Built-in `coerce()`**, one function |
| Async validation | Manual promise chaining | Separate `YupSchema` | `Joi.any().custom()` | **Mirror API**: `objectAsync`, `arrayAsync`, etc. |
| Context / request-scoped data | Not supported | Not supported | Not supported | **`ctx` forwarding** through every level |
| Schema metadata | `z.ZodType` internals only | None | `.describe()` | **`METADATA` symbol**: use for codecs/serialization |
| Bundle size | ~35 KB min+gzip | ~20 KB | ~50 KB+ | **~5.4 KB min+gzip**, zero deps |

Veta matches **Zod's type inference quality** at ~5.4 KB min+gzip (vs. Zod's ~35 KB), and adds features Zod doesn't have: context forwarding, async mirror API, and schema metadata for binary serialization (used by `@coderbuzz/proto`).

---

## Highlights

- **Object shorthand syntax**: write `{ tags: [string()] }` instead of `{ tags: array(string()) }`
- **`.map()` on objects**: remap keys, extract deep paths, transform before validation
- **Built-in coercion**: `coerce(number())` accepts `"42"` → `42` from any source (form data, env vars, query params)
- **Sync + Async APIs**: `objectAsync` / `arrayAsync` / `tupleAsync` / `unionAsync` / `pipeAsync` with the same mental model
- **Context forwarding**: pass request-scoped data (SSP identifiers, auth, tenant IDs) through every validator
- **Schema metadata**: `METADATA` symbol for encoding layers like `@coderbuzz/proto`
- **Custom error messages**: per-validator or per-rule via `ValidationRule<T>`
- **Zero dependencies**: no runtime overhead, no `zod` baggage
- **Runtime agnostic**: Bun, Deno, Node.js, browsers (any ES2022 runtime)

---

## Benchmarks

Full results at **[github.com/coderbuzz/benchmarks](https://github.com/coderbuzz/benchmarks)**.

All tests on Apple M-series, Bun runtime. Higher is better.

| Scenario | @coderbuzz/veta | Zod | Factor |
|---|---|---|---|
| Simple object `{ name, age, active }` | **24.01M ops/s** | 3.33M | **7.2x** |
| Complex nested object + coercion | **3.89M ops/s** | 1.02M | **3.8x** |
| Coercion `coerce(number/boolean/string/date)` | **10.04M ops/s** | 2.23M | **4.5x** |
| Error handling (invalid input) | **1.23M ops/s** | 0.81M | **1.5x** |

> See the benchmarks repo for full methodology, machine specs, and run scripts.

---

## Installation

```sh
# npm
npm install @coderbuzz/veta

# Bun
bun add @coderbuzz/veta

# Deno
import { object, string } from "npm:@coderbuzz/veta";
```

---

## Quick Example

```ts
import {
  array,
  coerce,
  number,
  object,
  optional,
  string,
} from "@coderbuzz/veta";

const createUser = object({
  id: coerce(number({ min: 1 })),
  name: string({ min: 3 }),
  email: string({ pattern: /@/ }),
  tags: optional(array(string())),
});

const user = createUser({
  id: "42", // coerced "42" → 42
  name: "John Doe",
  email: "john@example.com",
  tags: ["admin", "owner"],
  extra: "ignored", // stripped, only validated keys are returned
});
// { id: 42, name: "John Doe", email: "john@example.com", tags: ["admin", "owner"] }
```

Every example in this doc works with **zero modification** across Bun, Deno, and Node.js.

---

## Comparison Examples

### Veta vs Zod: Nested Schema

```ts
// Zod: every level needs wrapping
import { z } from "zod";
const zodSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      tags: z.array(z.string()),
    }),
  }),
});

// Veta: shorthand auto-detects nested objects and arrays
import { object, string } from "@coderbuzz/veta";
const vetaSchema = object({
  user: {
    profile: {
      name: string(),
      tags: [string()],
    },
  },
});
```

### Veta vs Zod: Coercion

```ts
// Zod: separate API surface
const zCoerce = z.object({
  id: z.coerce.number(),
  active: z.coerce.boolean(),
});

// Veta: one function, consistent
const vCoerce = object({
  id: coerce(number()),
  active: coerce(boolean()),
});
```

### Veta vs Zod: Async Validation

```ts
// Zod: async checks go through `.refine(async ...)` and require `parseAsync()`

// Veta: a field validator is itself the async function
const checkUsername = async (val: unknown) => {
  const name = string({ min: 3 })(val);
  const exists = await db.users.exists({ name });
  if (exists) throw new Error("Username already taken");
  return name;
};

const createAccount = objectAsync({
  username: checkUsername,
  displayName: string({ min: 1 }),
  role: optional(string()),
});
// All fields validated concurrently via Promise.all
```

---

## Primitive Validators

All primitive validators throw a `VetaError` (extends `Error`) on invalid input and return the
validated (and possibly coerced) value on success.

### `string(options?)`

```ts
const v = string({ min: 3, max: 100, pattern: /^[a-z]+$/ });
v("hello"); // "hello"
v("ab"); // throws "String too short (min: 3)"
v(123); // throws "Invalid string: expected string, got number"
```

**Options:**

| Option            | Type                     | Description                                 |
| ----------------- | ------------------------ | ------------------------------------------- |
| `min`             | `ValidationRule<number>` | Minimum string length (inclusive)           |
| `max`             | `ValidationRule<number>` | Maximum string length (inclusive)           |
| `pattern`         | `ValidationRule<RegExp>` | Regex pattern to test against               |
| `message`         | `string`                 | Fallback message for all validation errors  |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null` |

Strict by default. Only accepts `string` values. Use `coerce(string())` to cast
any value via `String(val)`.

**`pattern` must not be sticky, and `/g` is ignored.** `.test()` on a `/g` or
`/y` regex advances `lastIndex` on the regex object, which the validator holds
for its whole lifetime. The same input would then pass and fail on alternate
calls, across requests. A `/g` flag is dropped when the validator is built
(other flags are kept); a `/y` flag throws, because it also changes what the
pattern matches.

---

### `number(options?)`

```ts
const v = number({ min: 0, max: 100 });
v(50); // 50
v(-1); // throws "Number too small (min: 0)"
v("50"); // throws "Invalid number: expected number, got string"
v(NaN); // throws "Invalid number: expected a finite number, got NaN"
v(Infinity); // throws "Invalid number: expected a finite number, got Infinity"
```

**Options:**

| Option            | Type                     | Description                                 |
| ----------------- | ------------------------ | ------------------------------------------- |
| `min`             | `ValidationRule<number>` | Minimum value (inclusive)                   |
| `max`             | `ValidationRule<number>` | Maximum value (inclusive)                   |
| `message`         | `string`                 | Fallback message for all validation errors  |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null` |

Strict by default. Only accepts finite numbers: `NaN`, `Infinity` and
`-Infinity` are all rejected, in coerce mode too. This matters for amounts,
because `min` alone does not stop infinity (`Infinity >= 0`) and
`JSON.parse('{"amount":1e400}')` yields `Infinity` without any error, so it can
arrive straight from a request body and turn a balance into `NaN`.

`coerce(number())` accepts a `number`, or a `string` in plain decimal notation
(optional sign, digits, optional fraction, optional exponent; surrounding
whitespace is trimmed). Everything else is rejected, including `true`, `[]`,
`{}`, `'0x10'` and `'1e400'`.

It used to be `Number(val)`, which inherits every JavaScript conversion quirk,
on the path query strings and form data take. `[]` was the dangerous one: a query
parser that yields an array for a repeated parameter (`?amount=&amount=`) gave
`[]`, which became a silent `0`: a payment field that should have failed
validation recorded as a zero payment, found at bank reconciliation rather than
at request time.

---

### `boolean(options?)`

```ts
const v = boolean();
v(true); // true
v(false); // false
v("true"); // throws "Invalid boolean: expected boolean, got string"
```

Coerce mode accepts `true`, `false`, `"true"`, `"false"`, `1`, `"1"`, `0`,
`"0"`.

**Options:** `message`, `requiredMessage`

---

### `date(options?)`

```ts
const v = date({ min: new Date("2020-01-01") });
v(new Date("2025-06-01")); // Date instance
v("2025-06-01"); // throws "Invalid date: expected Date instance"
```

Strict mode only accepts `Date` instances. Use `coerce(date())` to parse ISO
strings and numeric timestamps via `new Date(val)`.

**Options:**

| Option            | Type                   | Description                                 |
| ----------------- | ---------------------- | ------------------------------------------- |
| `min`             | `ValidationRule<Date>` | Earliest allowed date (inclusive)           |
| `max`             | `ValidationRule<Date>` | Latest allowed date (inclusive)             |
| `message`         | `string`               | Fallback message                            |
| `requiredMessage` | `string`               | Message when value is `undefined` or `null` |

---

### `bigint(options?)`

```ts
const v = bigint({ min: 0n, max: 1000n });
v(500n); // 500n
v(1001n); // throws "BigInt too large (max: 1000)"
v("123"); // throws "Invalid bigint: expected bigint, got string"
```

Use `coerce(bigint())` to cast strings and numbers via `BigInt(val)`. Float
values like `1.5` throw even in coerce mode.

**`coerce()` only wraps the primitives that define a coerced form**: `string`,
`number`, `boolean`, `date`, `bigint`, `decimal`. Anything else throws where you
write it. It used to return the validator unchanged, so
`coerce(object({ amount: number() }))` looked like it coerced into the shape and
did nothing at all. The strict `number()` inside then rejected every form value.
Apply it to the fields instead: `object({ amount: coerce(number()) })`.

**Options:** `min`, `max`, `message`, `requiredMessage` (same pattern as `number`)

---

### `decimal(options?)`: money

```ts
const amount = decimal({ precision: 18, scale: 2 });

amount("1234.5");   // "1234.50", padded, so equal amounts are equal strings
amount("007.50");   // "7.50", leading zeros normalized
amount("-0.00");    // "0.00", negative zero is zero
amount("1234.567"); // throws, 3 fraction digits, scale is 2
amount(1234.5);     // throws, a float64 cannot be trusted here
amount(1234n);      // "1234.00", bigint is exact, so it is accepted
```

Validates an exact fixed-scale decimal and returns a **normalized string**, never
a `number`. This is the same representation `@coderbuzz/sql` infers for
`DECIMAL`/`NUMERIC` columns, and the same one the `pg` and `mysql2` drivers
already hand back, so a value crosses the HTTP/database boundary with no
conversion step. Conversion steps are where precision is lost.

`number()` cannot do this job:

```ts
number()(0.1 + 0.2);        // 0.30000000000000004
number()(9007199254740993); // 9007199254740992, silently
```

Summing float64 amounts also depends on the order they are added, so
`total debit === total credit` can hold or fail for the same rows depending on
how the query returned them. Do arithmetic in SQL (`SUM`, `*`, `ROUND` on
`NUMERIC` are exact) or in a decimal library.

**Options:**

| Option            | Type                     | Description                                                     |
| ----------------- | ------------------------ | --------------------------------------------------------------- |
| `scale`           | `ValidationRule<number>` | Maximum fraction digits. Output is padded to exactly this many   |
| `precision`       | `ValidationRule<number>` | Maximum total digits, as in `NUMERIC(precision, scale)`          |
| `min`             | `ValidationRule<string>` | Inclusive minimum, written as a decimal string                   |
| `max`             | `ValidationRule<string>` | Inclusive maximum, written as a decimal string                   |
| `message`         | `string`                 | Fallback message for all validation errors                       |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null`                      |

A value with more fraction digits than `scale` is **rejected, not rounded**:
silently dropping a digit of someone's money is the failure this validator
exists to prevent. Bounds are compared exactly via scale-aligned `BigInt`, so
they stay correct past 2^53-1.

`coerce(decimal())` additionally accepts a `number`, but only a safe integer:
anything fractional has already lost precision before the validator saw it, and
turning it into a string would launder that into something that looks exact.

There is deliberately no `money()` with a default scale. The right scale is a
property of the currency (IDR is usually 0, most are 2, some are 3) and of the
column you are writing to. Declare it.

---

### `uint8array(options?)`

```ts
const v = uint8array({ min: 4 });
v(new Uint8Array([1, 2, 3, 4])); // Uint8Array
v(new Uint8Array([1, 2])); // throws "Uint8Array too short (min: 4)"
v([1, 2, 3]); // throws "Invalid Uint8Array"
```

`Buffer` (which extends `Uint8Array`) is accepted. No coerce variant.

**Options:** `min`, `max`, `message`, `requiredMessage`

---

### `any()` and `unknown()`

Passthrough validators: accept and return any value without modification.

```ts
const v1 = any();
v1(null); // null
v1(undefined); // undefined

const v2 = unknown();
v2([1, 2, 3]); // [1, 2, 3]
```

---

## Custom Error Messages

Every validator supports two error customization points.

### Fallback `message`

Overrides all error text for the validator:

```ts
string({ message: "Invalid name format" });
number({ message: "Price must be a number" });
boolean({ message: "Must be true or false" });
```

### Fallback `requiredMessage`

Used when the value is `undefined` or `null`:

```ts
string({ requiredMessage: "Name is required" });
number({ requiredMessage: "Age is required" });
object({ name: string() }, { requiredMessage: "Request body is required" });
array(string(), { requiredMessage: "Tags array is required" });
```

### Per-rule `ValidationRule<T>`

Each constraint option accepts either a plain value **or** a
`{ value, message }` object for a rule-specific message:

```ts
// Plain value: uses default message
string({ min: 10 });

// ValidationRule: custom message for this rule only
string({
  min: { value: 10, message: "Username must be at least 10 characters" },
  pattern: {
    value: /^[a-z0-9]+$/,
    message: "Only lowercase letters and numbers",
  },
});

number({
  min: { value: 18, message: "Must be 18 or older" },
  max: { value: 120, message: "Age seems invalid" },
});

coerce(date({
  min: { value: new Date("2020-01-01"), message: "Date must be after 2020" },
}));
```

---

## Coercion

`coerce(validator)` wraps a primitive validator to accept loose input. Use this
for form data, query parameters, environment variables, or any source where
values arrive as strings.

```ts
import { boolean, coerce, date, number, string } from "@coderbuzz/veta";

const parsePage = coerce(number({ min: 1 })); // "3" → 3
const parseActive = coerce(boolean()); // "true" → true, "1" → true
const parseDate = coerce(date()); // "2024-01-01" → Date
const parseBigId = coerce(bigint()); // "99999999" → 99999999n
const parseLabel = coerce(string({ min: 1 })); // 123 → "123"
```

Coercion rules by type:

| Type      | Coerce behavior                                                           |
| --------- | ------------------------------------------------------------------------- |
| `string`  | `String(val)`                                                             |
| `number`  | a `number`, or a plain decimal string (trimmed); `""`, hex, `Infinity`, booleans, arrays throw |
| `boolean` | `true`/`"true"`/`1`/`"1"` → `true`; `false`/`"false"`/`0`/`"0"` → `false` |
| `date`    | `new Date(val)`, invalid dates throw                                     |
| `decimal` | a decimal string, a `bigint`, or a safe integer `number`                 |
| `bigint`  | `BigInt(val)`, floats and non-numeric strings throw; note `""` and `[]` give `0n`, `true` gives `1n` |

`coerce()` composes with all wrappers:

```ts
optional(coerce(number())); // undefined | coerced number
nullable(coerce(date())); // null | coerced Date
nullish(coerce(boolean())); // undefined | null | coerced boolean
```

---

## Composition Helpers

### `object(shape, options?)`

Validates an object and returns a new object containing **only** the validated
properties (extra keys are stripped). Each property is validated by its
corresponding validator in the shape.

```ts
const schema = object({
  id: coerce(number()),
  name: string({ min: 2 }),
  role: optional(string()),
});

schema({ id: "1", name: "John", role: "admin", extra: "ignored" });
// { id: 1, name: "John", role: "admin" }
```

Errors from nested properties include the key name:

```
Property "id": Invalid number: expected number, got string
```

**Options:** `message` (used when input is not an object), `requiredMessage`,
`unknownKeys` (`'strip'` default, `'error'`, `'passthrough'`; see
[Rejecting unknown keys](#rejecting-unknown-keys))

---

### Object Shorthand Syntax

Instead of manually wrapping every nested type, you can write plain objects,
single-element arrays, and multi-element arrays directly in the shape:

```ts
// Shorthand               →  Equivalent explicit form
{ address: { city: string() } }          → { address: object({ city: string() }) }
{ tags: [string()] }                      → { tags: array(string()) }
{ pair: [string(), coerce(number())] }    → { pair: tuple([string(), coerce(number())]) }
{ items: [{ id: number(), name: string() }] } → { items: array(object({ id: number(), name: string() })) }
```

The shorthand works recursively and is zero-overhead: normalization happens
once at schema construction time.

```ts
const schema = object({
  company: string(),
  metadata: {
    createdAt: coerce(date()),
    tags: [string()],
  },
  departments: [{
    id: coerce(number()),
    name: string(),
    employees: [{
      empId: coerce(number()),
      name: string(),
    }],
  }],
});
```

---

### `object().map(mapping)`

`.map()` creates a new validator where each shape property reads its value from
a different key or a computed expression. This is useful when validating data
with different key names, nested paths, or transformation logic.

```ts
const schema = object({
  name: string(),
  age: coerce(number()),
}).map({
  age: "userAge", // read from input.userAge
  name: (data) => data.profile?.fullName, // compute from nested path
});

schema({ profile: { fullName: "Jane" }, userAge: "30" });
// { name: "Jane", age: 30 }
```

**Mapping options per key:**

| Value type  | Behavior                                         |
| ----------- | ------------------------------------------------ |
| `string`    | Read from `input[altKey]`                        |
| `function`  | Call `mapFn(input)` and pass result to validator |
| _(omitted)_ | Read from `input[key]` as normal                 |

The validator `.map()` returns ignores the `unknownKeys` option and carries no
`METADATA`, so it cannot be passed to `@coderbuzz/proto`.

`.map()` supports nesting and works alongside `optional`, `nullable`, `nullish`,
`array`, and `union`:

```ts
const schema = object({
  id: coerce(number()),
  profile: nullable(
    object({
      bio: string(),
      avatar: string(),
    }).map({ bio: "biography" }),
  ),
}).map({
  id: (data) => data.user?.id,
});
```

---

### `array(validator, options?)`

```ts
const v = array(coerce(number()), { min: 1, max: 10 });
v(["1", "2", "3"]); // [1, 2, 3]
v([1, "bad"]); // throws "Item at index 1: Invalid number: ..."
```

**Options:** `min`, `max`, `message`, `requiredMessage`

---

### `tuple(validators, options?)`

A fixed-length array where each position has its own validator.

```ts
const v = tuple([string({ min: 2 }), coerce(number()), coerce(boolean())]);
v(["ab", "50", "true"]); // ["ab", 50, true]
v(["ab", "50"]); // throws "Expected tuple of length 3, got 2"
v(["a", "50", "true"]); // throws "Item at index 0: String too short (min: 2)"
```

**Options:** `message` (for non-array input), `requiredMessage`

---

### `union(validators, options?)`

Tries each validator in order and returns the first success. Throws if all fail.

```ts
const v = union([number(), string()]);
v(42); // 42  (number wins)
v("hello"); // "hello" (string wins)
v(true); // throws "Value does not match any of the union types"
```

Order matters, the first matching validator wins:

```ts
union([coerce(string()), coerce(number())]); // everything becomes string
union([coerce(number()), string()]); // "123" → 123, "abc" → "abc"
```

Use `literal()` in a union to build discriminated unions:

```ts
const role = union([literal("admin"), literal("editor"), literal("viewer")]);
```

**Options:** `message` (used when all validators fail)

---

### `literal(value, options?)`

Validates strict equality against a single value.

```ts
const v = literal("admin");
v("admin"); // "admin"
v("user"); // throws "Value must be exactly: \"admin\""

literal(42, { message: "Must be the answer" });
```

Supported value types: `string`, `number`, `boolean`.

---

### `optional(validator)`

Passes `undefined` through; delegates all other values to the wrapped validator.

```ts
const v = optional(string());
v("hello"); // "hello"
v(undefined); // undefined
v(null); // throws "Required" (null is NOT undefined)
v(123); // throws "Invalid string: ..."
```

---

### `nullable(validator)`

Passes `null` through; delegates all other values to the wrapped validator.

```ts
const v = nullable(number());
v(42); // 42
v(null); // null
v(undefined); // throws "Required" (undefined is NOT null)
```

---

### `nullish(validator)`

Passes both `undefined` and `null` through.

```ts
const v = nullish(coerce(number()));
v(42); // 42
v("42"); // 42 (coerced)
v(null); // null
v(undefined); // undefined
v("abc"); // throws "Invalid number: ..."
```

---

### `pipe(validators, options?)`

Runs validators in sequence, passing the output of each as the input to the
next. The return type is the last validator's return type.

```ts
// Trim → lowercase → validate
const trim = (val: any) => String(val).trim();
const lower = (val: any) => String(val).toLowerCase();
const v = pipe([trim, lower, string({ min: 3, pattern: /^[a-z]+$/ })]);
v("  HELLO  "); // "hello"

// String → parse JSON → validate shape
const parseJson = (val: any) => JSON.parse(val);
const v2 = pipe([
  string(),
  parseJson,
  object({ name: string(), age: coerce(number()) }),
]);
v2('{"name":"John","age":"30"}'); // { name: "John", age: 30 }
```

Use `options.message` to wrap all pipeline errors with a single message:

```ts
pipe([string(), coerce(number({ min: 100 }))], { message: "Invalid score" });
```

---

## Async Validators

`object`, `array`, `tuple`, `union` and `pipe` have an `Async` counterpart. Sync
validators run immediately; async validators run concurrently via `Promise.all`
(`unionAsync` and `pipeAsync` run in order).

### `objectAsync(shape, options?)`

```ts
const checkUsername = async (val: unknown) => {
  const name = string({ min: 3 })(val);
  const exists = await db.users.exists({ name });
  if (exists) throw new Error("Username already taken");
  return name;
};

const createAccount = objectAsync({
  username: checkUsername,
  displayName: string({ min: 1 }),
  role: optional(string()),
});

const account = await createAccount({
  username: "john_doe",
  displayName: "John Doe",
});
```

Concurrent execution, slow and fast async validators run in parallel:

```ts
const schema = objectAsync({ a: slowValidator, b: fastValidator });
// Both run concurrently via Promise.all
```

**Options:** `message`, `requiredMessage` (no `unknownKeys`: extra keys are always stripped)

---

### `arrayAsync(validator, options?)`

```ts
const enrich = async (id: any) => {
  const n = coerce(number())(id);
  const record = await db.findById(n);
  return record;
};

const v = arrayAsync(enrich, { min: 1, max: 50 });
await v(["1", "2", "3"]); // concurrent, all IDs fetched in parallel
```

---

### `tupleAsync(validators, options?)`

```ts
const v = tupleAsync([string(), asyncLookup, coerce(boolean())]);
const [name, record, active] = await v(["john", "id-42", "true"]);
```

---

### `unionAsync(validators, options?)`

Tries validators sequentially (awaiting each), returns first success.

```ts
const v = unionAsync([asyncPositiveNumber, string({ min: 3 })]);
await v(42); // 42
await v("hello"); // "hello"
```

---

### `pipeAsync(validators, options?)`

```ts
const v = pipeAsync([
  string(),
  async (val) => val.trim().toUpperCase(),
  (val) => ({ normalized: val }),
]);
await v("  hello  "); // { normalized: "HELLO" }
```

---

### Shorthand in Async Schemas

Object shorthand syntax works identically inside `objectAsync`:

```ts
const schema = objectAsync({
  id: string(),
  track: {
    imp: [asyncEncodeUrl],
    progress: [{ t: coerce(number()), url: string() }],
    revoke: [string()],
  },
});
```

---

## Context Passing

Every validator accepts an optional second argument `ctx` that is forwarded
through all composition helpers. This lets you pass request-scoped data (SSP
identifiers, auth info, tenant IDs, etc.) into leaf validators without threading
it through your own code.

```ts
// Custom leaf validator that uses ctx
const encodeUrl = (val: any, ctx?: { ssp: string }) =>
  `${ctx?.ssp ?? ""}:${val}`;

const adResponseSchema = object({
  id: string(),
  ad: nullable(object({
    id: string(),
    track: object({
      imp: array(encodeUrl),
      revoke: array(encodeUrl),
    }),
  })),
});

const result = adResponseSchema(rawData, { ssp: "gam" });
// result.ad.track.imp → "gam:url1", "gam:url2"
```

Context is forwarded through the **compound** validators: `object`, `array`,
`tuple`, `union`, `pipe`, `optional`, `nullable`, `nullish`, `objectAsync`,
`arrayAsync`, `tupleAsync`, `unionAsync`, `pipeAsync`.

The built-in **leaf** validators (`string`, `number`, `boolean`, `date`,
`bigint`, `decimal`, `uint8array`, `literal`) take one argument and ignore any
context passed to them. They have no children to forward it to and no use for it
themselves. Your own validators are where context is read; `withContext()` makes
a missing one a clear failure rather than a `TypeError`.

---

## Type Inference

```ts
import type { InferAsyncObject, InferObject } from "@coderbuzz/veta";
import { number, object, optional, string } from "@coderbuzz/veta";

// Sync schema
const articleShape = {
  id: number(),
  title: string(),
  summary: optional(string()),
};
type Article = InferObject<typeof articleShape>;
// { id: number; title: string; summary?: string | undefined }

const validateArticle = object(articleShape);

// Async schema
import { objectAsync } from "@coderbuzz/veta";
const asyncShape = { id: number(), name: string() };
type AsyncResult = InferAsyncObject<typeof asyncShape>;
// or from the validator: Awaited<ReturnType<typeof asyncSchema>>
const asyncSchema = objectAsync(asyncShape);
```

Additional utility types:

| Type                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `InferObject<S>`      | Infers the output type of a sync object shape                       |
| `InferAsyncObject<S>` | Infers the output type of an async object shape (unwraps `Promise`) |
| `InferEntry<T>`       | Infers the output type of a single shape entry                      |
| `InferAsyncEntry<T>`  | Infers the async output type of a single shape entry                |
| `ValidationRule<T>`   | `T \| { value: T; message: string }`, for custom per-rule messages |
| `TypeMeta`            | Discriminated union describing the shape of a validator             |

```ts
import type { InferEntry, InferAsyncEntry } from "@coderbuzz/veta";
import { coerce, number, object, optional, string } from "@coderbuzz/veta";

// InferEntry: extract output type from a single validator
const tag = string();
type TagType = InferEntry<typeof tag>;
// string

const count = number();
type CountType = InferEntry<typeof count>;
// number

// InferAsyncEntry: extract async output type from a single entry
const asyncLookup = async (val: any) => {
  const id = coerce(number())(val);
  return await db.findById(id);
};
type LookupType = InferAsyncEntry<typeof asyncLookup>;
// Awaited<ReturnType<typeof asyncLookup>>

// Full shape inference
const shape = { id: number(), name: string(), role: optional(string()) };
type Entity = InferObject<typeof shape>;
// { id: number; name: string; role?: string | undefined }
```

---

## Schema Metadata (`METADATA`)

Every built-in sync validator exposes a `METADATA` symbol property describing its
shape as a `TypeMeta` object. This is used by encoding layers (e.g.,
`@coderbuzz/proto`) to drive serialization without re-parsing the validator.

```ts
import {
  array,
  METADATA,
  number,
  object,
  optional,
  string,
} from "@coderbuzz/veta";
import type { TypeMeta } from "@coderbuzz/veta";

const schema = object({
  id: number(),
  name: string(),
  tags: optional(array(string())),
});

const meta = (schema as any)[METADATA] as TypeMeta;
// {
//   type: "object",
//   shape: {
//     id:   { type: "number" },
//     name: { type: "string" },
//     tags: { type: "optional", inner: { type: "array", items: { type: "string" } } }
//   }
// }
```

**`TypeMeta` variants:**

```ts
type TypeMeta =
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" }
  | { type: "bigint" }
  | { type: "date" }
  | { type: "uint8array" }
  | { type: "any" }
  | { type: "unknown" }
  | { type: "literal"; value: any }
  | { type: "object"; shape: Record<string, TypeMeta> }
  | { type: "array"; items: TypeMeta }
  | { type: "tuple"; items: TypeMeta[] }
  | { type: "optional"; inner: TypeMeta }
  | { type: "nullable"; inner: TypeMeta }
  | { type: "nullish"; inner: TypeMeta }
  | { type: "union"; variants: TypeMeta[] };
```

Notes:
- `coerce(validator)` preserves the inner validator's metadata.
- `pipe(validators)` uses the last validator's metadata.
- `decimal()` carries `{ type: "string" }`.
- Custom function validators, `withContext()`, and the async variants have no metadata.
- `array`, `tuple`, `union`, `optional`, `nullable` and `nullish` get metadata only
  when every child has it. `object()` always gets metadata, but silently leaves out
  fields whose validator has none.

---

## Error Reference

All validators throw `VetaError` (exported from `@coderbuzz/veta`) when validation fails.
`VetaError` extends `Error`. Use `err instanceof VetaError` to distinguish validation
failures from other runtime errors.

```ts
import { VetaError, string } from "@coderbuzz/veta";

try {
  string({ min: 3 })(input);
} catch (err) {
  if (err instanceof VetaError) {
    console.log(err.message); // "String too short (min: 3)"
    console.log(err.path);    // [], structured path to the failing field
  }
}
```

`path` tracks traversal through nested objects, arrays, and tuples:
`["users", 1, "email"]` for the 2nd user's email field.

Messages follow a consistent pattern:

| Situation                | Message pattern                                                |
| ------------------------ | -------------------------------------------------------------- |
| `undefined`/`null` input | `"Required"` (or `requiredMessage`)                            |
| Wrong type               | `"Invalid string: expected string, got number"`                |
| Non-finite number        | `"Invalid number: expected a finite number, got Infinity"`     |
| Constraint failed        | `"String too short (min: 3)"`, `"Number too large (max: 100)"` |
| Object property error    | `"Property \"key\": <inner message>"`                          |
| Array element error      | `"Item at index 2: <inner message>"`                           |
| Union exhausted          | `"Value does not match any of the union types"`                |
| Literal mismatch         | `"Value must be exactly: \"admin\""`                           |
| Tuple length mismatch    | `"Expected tuple of length 3, got 2"`                          |

Errors nest naturally for deep schemas:

```
Property "departments": Item at index 0: Property "manager": Invalid email
```

### Collecting every error

Throwing stops at the first bad field. That is right for a hot path and wrong
for a form: the user fixes one field, submits, and is told about the next one.
`safeParse` returns all of them:

```ts
import { safeParse, object, array, string, decimal } from "@coderbuzz/veta";

const journal = object({
  ref: string({ min: 3 }),
  lines: array(object({ account: string(), amount: decimal({ scale: 2 }) })),
});

const result = safeParse(journal, { ref: "x", lines: [{ account: 1, amount: "10.005" }] });

if (!result.ok) {
  result.issues;
  // [
  //   { path: ["ref"],                 message: "String too short (min: 3)" },
  //   { path: ["lines", 0, "account"], message: "Invalid string: expected string, got number" },
  //   { path: ["lines", 0, "amount"],  message: "Too many fraction digits (max: 2)" },
  // ]
} else {
  result.value; // fully typed
}
```

`safeParseAsync` is the counterpart for `objectAsync`/`arrayAsync`/`tupleAsync`
schemas.

Each issue's `message` is the leaf validator's own, without the
`Property "x": Item at index 2:` prefixes the throwing form builds, since `path`
already says where it happened and a form wants the two separately.

`union()`, `pipe()` and your own custom validators stay leaves: a union has no
single child to attribute a failure to, a pipe stage cannot run on a value the
previous stage rejected, and a custom validator does not know about the
collector. Each contributes one issue rather than several.

Calling a validator directly is completely unaffected. It throws on the first
failure exactly as before.

### Why a union or pipe rejected a value

`VetaError.issues` carries the reasons a composite validator gave up:

```ts
try {
  union([cardPayment, cashPayment])({ kind: "card", number: "123" });
} catch (err) {
  err.message;  // "Value does not match any of the union types"
  err.issues;
  // [
  //   { path: ["number"], message: "Variant 0: String too short (min: 16)" },
  //   { path: ["kind"],   message: 'Variant 1: Value must be exactly: "cash"' },
  // ]
}
```

Without it, a failed union said only "Value does not match any of the union
types": not which variant came closest, not which field was wrong, not even
that the problem was the card number. Answering that support ticket meant
reproducing it with the user's payload.

`pipe([...], { message })` does the same: the custom message is what you asked
for, and the stage's own error is kept in `issues` rather than discarded.

### Rejecting unknown keys

```ts
const patch = object({ memo: optional(string()) }, { unknownKeys: "error" });

patch({ memmo: "audit correction" });  // throws: Unknown key: "memmo"
```

`unknownKeys` is `'strip'` by default: unchanged behaviour, keys the shape does
not mention are dropped. `'error'` rejects them, `'passthrough'` copies them onto
the result unvalidated.

`'error'` is worth reaching for on a partial-update endpoint. With `'strip'`, a
`PATCH` body of `{ "memmo": "audit correction" }` (a typo for `memo`) validates
cleanly to `{}`, the update changes nothing, and the API answers 200. The user
believes the note was saved. For records with audit consequences, succeeding
while doing nothing is worse than failing.

### Validators that need a context

`ctx` is optional and `any` on every validator, so nothing tells you a validator
needs one, and nothing fails when a caller forgets. `withContext` narrows that at
the one place it matters:

```ts
import { withContext, string, VetaError } from "@coderbuzz/veta";

type AppCtx = { tenantId: string };

const accountCode = withContext<string, AppCtx>((val, ctx) => {
  const code = string({ min: 1 })(val);
  if (!accountsOf(ctx.tenantId).has(code)) throw new VetaError("Unknown account");
  return code;
});

accountCode("1000");                       // throws VetaError: requires a context
accountCode("1000", { tenantId: "acme" }); // "1000"
```

Without it, a forgotten context gives you `ctx.tenantId` throwing a `TypeError`,
which is not a `VetaError`, so it slips past your validation error handler and
becomes a 500; or, if the validator was written defensively as `ctx?.tenantId`,
a lookup against `undefined` that rejects everything, or accepts everything.

Pass the context through the schema with `safeParse(schema, value, ctx)`.

---

## Complete Example

```ts
import {
  array,
  boolean,
  coerce,
  date,
  type InferObject,
  literal,
  nullable,
  number,
  object,
  optional,
  pipe,
  string,
  union,
} from "@coderbuzz/veta";

// ── Shape definition ──────────────────────────────────────────
const addressShape = {
  street: string(),
  city: string(),
  zip: string({ pattern: /^\d{5}$/, message: "Invalid ZIP code" }),
};

const userSchema = object({
  id: coerce(number({ min: 1 })),
  name: string({ min: 2, max: 100 }),
  email: pipe([string(), (s: string) => s.toLowerCase().trim()]),
  role: union([literal("admin"), literal("editor"), literal("viewer")]),
  birthDate: nullable(coerce(date())),
  address: optional(object(addressShape)), // optional() needs a validator, not a shape
  tags: optional(array(string())),
  scores: [coerce(number())], // shorthand, always required
});

// ── Inferred type ─────────────────────────────────────────────
type User = ReturnType<typeof userSchema>; // InferObject takes a shape, not a validator

// ── Validate ──────────────────────────────────────────────────
const user = userSchema({
  id: "42",
  name: "Jane Smith",
  email: "  jane@example.com  ",
  role: "admin",
  birthDate: null,
  address: { street: "123 Main St", city: "Springfield", zip: "62701" },
  tags: ["admin", "owner"],
  scores: ["95", "87", "100"],
});
// {
//   id: 42, name: "Jane Smith", email: "jane@example.com",
//   role: "admin", birthDate: null,
//   address: { street: "123 Main St", city: "Springfield", zip: "62701" },
//   tags: ["admin", "owner"], scores: [95, 87, 100]
// }
```

---

## Migration Guide: Zod → Veta

Most migrations from Zod are straightforward. Here are the key differences:

| Zod | Veta |
|---|---|
| `z.string()` | `string()` |
| `z.number()` | `number()` |
| `z.boolean()` | `boolean()` |
| `z.date()` | `date()` |
| `z.bigint()` | `bigint()` |
| `z.any()` | `any()` |
| `z.unknown()` | `unknown()` |
| `z.object({})` | `object({})` |
| `z.array(z.string())` | `array(string())` or shorthand `[string()]` |
| `z.tuple([...])` | `tuple([...])` or shorthand `[a, b]` with >1 element |
| `z.union([...])` | `union([...])` |
| `z.literal(v)` | `literal(v)` |
| `z.optional(z.string())` | `optional(string())` |
| `z.nullable(z.string())` | `nullable(string())` |
| `z.string().min(3)` | `string({ min: 3 })` |
| `z.string().max(100)` | `string({ max: 100 })` |
| `z.string().regex(/^a+$/)` | `string({ pattern: /^a+$/ })` |
| `z.coerce.number()` | `coerce(number())` |
| `.transform(fn)` | `pipe([validate, fn])` |
| `z.undefined()` | Used `optional()` |
| `.parse()` | Call as function: `schema(val)` |
| `.safeParse()` | `safeParse(schema, val)` |
| `z.infer<typeof S>` | `ReturnType<typeof schema>`, or `InferObject<typeof shape>` |

**Key behavioral differences:**
1. Veta uses **options objects** (`{ min: 3 }`) instead of **chainable methods** (`.min(3)`), by design for tree-shaking and TypeScript performance
2. Veta validators are **called as functions** (`schema(val)`) not `.parse(val)`
3. Veta **strips unknown keys** by default (like Zod's `.strip()`). Use `object(shape, { unknownKeys: 'passthrough' })` or `'error'` for Zod's `.passthrough()` / `.strict()`
4. Veta **throws `VetaError` on invalid input**. Use `safeParse(schema, val)` when you want every failure at once instead. See [Collecting every error](#collecting-every-error)
5. Veta's object shorthand accepts **plain objects** as nested object schemas, `[v]` as arrays, and `[v1, v2]` as tuples

---

## License

MIT © 2026 Indra Gunawan
