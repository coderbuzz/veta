<!-- docs: sync from coderbuzz/codex@d0bc006 -->

# Veta &mdash; `@coderbuzz/veta`

> Runtime-agnostic schema validation for TypeScript. Faster than Zod. Smaller than Yup. Smarter than Joi.
> AI agents: see [AI_KNOWLEDGE.md](https://github.com/coderbuzz/veta/blob/main/AI_KNOWLEDGE.md) for expert context.

**Veta** is a next-generation schema validation library designed from the ground up for TypeScript ergonomics. Zero dependencies. Full type inference. Built-in coercion. Sync _and_ async pipelines. Context forwarding. Schema metadata for serialization. All in a single, lightweight package that runs on **Bun, Deno, and Node.js**.

---

## Why Veta over Zod, Yup, or Joi?

| Pain Point | Zod | Yup | Joi | **Veta** |
|---|---|---|---|---|
| Nested object syntax | Must wrap every level with `z.object()` | Same | Same | **Shorthand**: plain objects auto-detect |
| Type coercion | `z.coerce.xxx()` or custom transforms | `.cast()` only | Separate module | **Built-in `coerce()`** — one function |
| Async validation | Manual promise chaining | Separate `YupSchema` | `Joi.any().custom()` | **Mirror API**: `objectAsync`, `arrayAsync`, etc. |
| Context / request-scoped data | Not supported | Not supported | Not supported | **`ctx` forwarding** through every level |
| Schema metadata | `z.ZodType` internals only | None | `.describe()` | **`METADATA` symbol** — use for codecs/serialization |
| Bundle size | ~35 KB min+gzip | ~20 KB | ~50 KB+ | **<5 KB gzip** — zero deps |

Veta matches **Zod's type inference quality** while being significantly lighter and adding features Zod doesn't have: context forwarding, async mirror API, and schema metadata for binary serialization (used by `@coderbuzz/proto`).

---

## Highlights

- **Object shorthand syntax** — write `{ tags: [string()] }` instead of `{ tags: array(string()) }`
- **`.map()` on objects** — remap keys, extract deep paths, transform before validation
- **Built-in coercion** — `coerce(number())` accepts `"42"` → `42` from any source (form data, env vars, query params)
- **Sync + Async APIs** — `objectAsync` / `arrayAsync` / `tupleAsync` / `unionAsync` / `pipeAsync` with the same mental model
- **Context forwarding** — pass request-scoped data (SSP identifiers, auth, tenant IDs) through every validator
- **Schema metadata** — `METADATA` symbol for encoding layers like `@coderbuzz/proto`
- **Custom error messages** — per-validator or per-rule via `ValidationRule<T>`
- **Zero dependencies** — no runtime overhead, no `zod` baggage
- **Runtime agnostic** — Bun, Deno, Node.js, browsers (any ES2022 runtime)

---

## Benchmarks

Full results at **[github.com/coderbuzz/benchmarks](https://github.com/coderbuzz/benchmarks)**.

All tests on Apple M-series, Bun runtime. Higher is better.

| Scenario | @coderbuzz/veta | Zod | Factor |
|---|---|---|---|---|
| Simple object `{ name, age, active }` | **20.52M ops/s** | 2.80M | **7.3x** |
| Complex nested object + coercion | **3.22M ops/s** | 0.92M | **3.5x** |
| Coercion `coerce(number/boolean/string/date)` | **10.24M ops/s** | 2.16M | **4.7x** |
| Error handling (invalid input) | **1.24M ops/s** | 0.83M | **1.5x** |

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
  extra: "ignored", // stripped — only validated keys are returned
});
// { id: 42, name: "John Doe", email: "john@example.com", tags: ["admin", "owner"] }
```

Every example in this doc works with **zero modification** across Bun, Deno, and Node.js.

---

## Comparison Examples

### Veta vs Zod: Nested Schema

```ts
// Zod — every level needs wrapping
import { z } from "zod";
const zodSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      tags: z.array(z.string()),
    }),
  }),
});

// Veta — shorthand auto-detects nested objects and arrays
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
// Zod — separate API surface
const zCoerce = z.object({
  id: z.coerce.number(),
  active: z.coerce.boolean(),
});

// Veta — one function, consistent
const vCoerce = object({
  id: coerce(number()),
  active: coerce(boolean()),
});
```

### Veta vs Zod: Async Validation

```ts
// Zod — no built-in async object validation
// You must manually await each field with Promise.all

// Veta — declarative async API
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

All primitive validators throw an `Error` on invalid input and return the
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

Strict by default — only accepts `string` values. Use `coerce(string())` to cast
any value via `String(val)`.

---

### `number(options?)`

```ts
const v = number({ min: 0, max: 100 });
v(50); // 50
v(-1); // throws "Number too small (min: 0)"
v("50"); // throws "Invalid number: expected number, got string"
v(NaN); // throws "Invalid number: ..."
```

**Options:**

| Option            | Type                     | Description                                 |
| ----------------- | ------------------------ | ------------------------------------------- |
| `min`             | `ValidationRule<number>` | Minimum value (inclusive)                   |
| `max`             | `ValidationRule<number>` | Maximum value (inclusive)                   |
| `message`         | `string`                 | Fallback message for all validation errors  |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null` |

Strict by default — only accepts `number` (not `NaN`). Use `coerce(number())` to
cast via `Number(val)`. Empty strings throw even in coerce mode.

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

**Options:** `min`, `max`, `message`, `requiredMessage` (same pattern as `number`)

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

Passthrough validators — accept and return any value without modification.

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
// Plain value — uses default message
string({ min: 10 });

// ValidationRule — custom message for this rule only
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
| `number`  | `Number(val)` — empty string throws                                       |
| `boolean` | `true`/`"true"`/`1`/`"1"` → `true`; `false`/`"false"`/`0`/`"0"` → `false` |
| `date`    | `new Date(val)` — invalid dates throw                                     |
| `bigint`  | `BigInt(val)` — floats and non-numeric strings throw                      |

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

**Options:** `message` (used when input is not an object), `requiredMessage`

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

The shorthand works recursively and is zero-overhead — normalization happens
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

Order matters — the first matching validator wins:

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

Every sync helper has an `Async` counterpart. Sync validators run immediately;
async validators run concurrently via `Promise.all`.

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

Concurrent execution — slow and fast async validators run in parallel:

```ts
const schema = objectAsync({ a: slowValidator, b: fastValidator });
// Both run concurrently via Promise.all
```

**Options:** `message`, `requiredMessage`

---

### `arrayAsync(validator, options?)`

```ts
const enrich = async (id: any) => {
  const n = coerce(number())(id);
  const record = await db.findById(n);
  return record;
};

const v = arrayAsync(enrich, { min: 1, max: 50 });
await v(["1", "2", "3"]); // concurrent — all IDs fetched in parallel
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

Context is forwarded through: `object`, `array`, `tuple`, `union`, `pipe`,
`optional`, `nullable`, `nullish`, `objectAsync`, `arrayAsync`, `tupleAsync`,
`unionAsync`, `pipeAsync`.

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
const asyncSchema = objectAsync({ id: number(), name: string() });
type AsyncResult = InferAsyncObject<
  typeof asyncSchema extends (...args: any[]) => Promise<infer R> ? R : never
>;
```

Additional utility types:

| Type                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `InferObject<S>`      | Infers the output type of a sync object shape                       |
| `InferAsyncObject<S>` | Infers the output type of an async object shape (unwraps `Promise`) |
| `InferEntry<T>`       | Infers the output type of a single shape entry                      |
| `InferAsyncEntry<T>`  | Infers the async output type of a single shape entry                |
| `ValidationRule<T>`   | `T \| { value: T; message: string }` — for custom per-rule messages |
| `TypeMeta`            | Discriminated union describing the shape of a validator             |

---

## Schema Metadata (`METADATA`)

Every validator exposes a `METADATA` symbol property describing its shape as a
`TypeMeta` object. This is used by encoding layers (e.g., protobuf, msgpack
schemas) to drive serialization without re-parsing the validator.

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
- Custom function validators have no metadata.

---

## Error Reference

All errors are plain `Error` instances. Messages follow a consistent pattern:

| Situation                | Message pattern                                                |
| ------------------------ | -------------------------------------------------------------- |
| `undefined`/`null` input | `"Required"` (or `requiredMessage`)                            |
| Wrong type               | `"Invalid string: expected string, got number"`                |
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
  address: optional(addressShape), // shorthand — no object() needed
  tags: optional([string()]), // shorthand — no array() needed
  scores: [coerce(number())], // shorthand — always required
});

// ── Inferred type ─────────────────────────────────────────────
type User = InferObject<typeof userSchema>;

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
| `.safeParse()` | Wrap in try-catch |
| `z.infer<typeof S>` | `InferObject<typeof S>` |

**Key behavioral differences:**
1. Veta uses **options objects** (`{ min: 3 }`) instead of **chainable methods** (`.min(3)`) — this is by design for tree-shaking and TypeScript performance
2. Veta validators are **called as functions** (`schema(val)`) not `.parse(val)`
3. Veta **strips unknown keys** by default (like Zod's `.strip()`) — there's no `.passthrough()` equivalent
4. Veta **throws on invalid input** — there's no `.safeParse()` equivalent; use try-catch
5. Veta's object shorthand accepts **plain objects** as nested object schemas, `[v]` as arrays, and `[v1, v2]` as tuples

---

## License

MIT © 2026 Indra Gunawan
