<!-- docs: sync from coderbuzz/codex@8746dea -->

# VETA — AI Agent Knowledge File

**Package:** `@coderbuzz/veta` v0.1.3\
**Purpose:** Runtime-agnostic TypeScript schema validation library.\
**Distribution:** ESM only (`dist/index.js` + `dist/index.d.ts`). No source
`.ts` files in the package.

---

## Mental Model

`veta` validators are **plain functions** with the signature
`(val: any, ctx?: any) => T`. They throw `Error` on invalid input and return the
validated value on success. Every function exported from `@coderbuzz/veta` either
**creates** a validator function or **wraps** one.

```
validator = (val: any, ctx?: any) => T    // throws on invalid, returns T on valid
```

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

Veta matches Zod's type inference quality while being significantly lighter and adding features Zod doesn't have: context forwarding, async mirror API, and schema metadata for binary serialization (used by `@coderbuzz/proto`).

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

---

## Comparison Examples

### Veta vs Zod: Nested Schema

```ts
// Zod — every level needs wrapping
const zodSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      tags: z.array(z.string()),
    }),
  }),
});

// Veta — shorthand auto-detects nested objects and arrays
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
// Zod — no built-in async object validation; manual Promise.all required

// Veta — declarative async API with concurrent execution
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

## Complete Import Map

```ts
import {
  any,
  array,
  arrayAsync,
  bigint,
  boolean,
  coerce,
  date,
  type InferAsyncEntry,
  type InferAsyncObject,
  type InferEntry,
  // Type inference helpers
  type InferObject,
  literal,
  // Metadata symbol
  METADATA,
  nullable,
  nullish,
  number,
  // Composition (sync)
  object,
  // Async variants
  objectAsync,
  optional,
  pipe,
  pipeAsync,
  // Primitives
  string,
  tuple,
  tupleAsync,
  type TypeMeta,
  uint8array,
  union,
  unionAsync,
  unknown,
  type ValidationRule,
} from "@coderbuzz/veta";
```

---

## Primitive Validators

### string(options?)

```ts
string(); // strict: only string
string({ min: 3 }); // min length
string({ max: 100 }); // max length
string({ pattern: /^[a-z]+$/ }); // regex test
string({ min: 3, max: 50, pattern: /^\w+$/ });
coerce(string()); // String(val) — accepts anything non-null/undefined
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<number>` | Minimum string length (inclusive) |
| `max` | `ValidationRule<number>` | Maximum string length (inclusive) |
| `pattern` | `ValidationRule<RegExp>` | Regex pattern to test against |
| `message` | `string` | Fallback message for all validation errors |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

Strict rejects: `null` → "Required", `undefined` → "Required", `123` → "Invalid string: expected string, got number"

### number(options?)

```ts
number(); // strict: only number (not NaN)
number({ min: 0 }); // inclusive minimum
number({ max: 100 }); // inclusive maximum
number({ min: 1, max: 999 });
coerce(number()); // Number(val) — empty string throws
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<number>` | Minimum value (inclusive) |
| `max` | `ValidationRule<number>` | Maximum value (inclusive) |
| `message` | `string` | Fallback message for all validation errors |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

Strict rejects: `null`/`undefined` → "Required", `"123"` → "Invalid number", `NaN` → "Invalid number"

### boolean(options?)

```ts
boolean(); // strict: only true/false
coerce(boolean()); // "true","1",1 → true; "false","0",0 → false
```

| Option | Type | Description |
|---|---|---|
| `message` | `string` | Fallback message for all validation errors |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

Strict rejects: `"true"` → "Invalid boolean: expected boolean, got string"

### date(options?)

```ts
date(); // strict: only Date instances
date({ min: new Date("2020-01-01") });
date({ max: new Date("2030-12-31") });
coerce(date()); // new Date(val) — parses ISO strings, timestamps
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<Date>` | Earliest allowed date (inclusive) |
| `max` | `ValidationRule<Date>` | Latest allowed date (inclusive) |
| `message` | `string` | Fallback message |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

### bigint(options?)

```ts
bigint(); // strict: only bigint
bigint({ min: 0n });
bigint({ max: 9999n });
coerce(bigint()); // BigInt(val) — "123" → 123n; floats (1.5) throw
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<bigint>` | Minimum value (inclusive) |
| `max` | `ValidationRule<bigint>` | Maximum value (inclusive) |
| `message` | `string` | Fallback message |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

### uint8array(options?)

```ts
uint8array(); // only Uint8Array (Buffer is accepted, it extends Uint8Array)
uint8array({ min: 4 }); // min byte length
uint8array({ max: 256 }); // max byte length
// No coerce variant
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<number>` | Minimum byte length (inclusive) |
| `max` | `ValidationRule<number>` | Maximum byte length (inclusive) |
| `message` | `string` | Fallback message |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

### any() and unknown()

```ts
any(); // passthrough, return type: any
unknown(); // passthrough, return type: unknown
// Both accept null, undefined, and everything else
```

---

## Custom Error Messages — ValidationRule<T>

Every constraint option is a `ValidationRule<T>`:

```ts
type ValidationRule<T> = T | { value: T; message: string };

// Plain value → default message
string({ min: 3 });

// Object form → custom message for this rule only
string({
  min: { value: 3, message: "Name too short" },
  max: { value: 50, message: "Name too long" },
  pattern: { value: /^\w+$/, message: "Alphanumeric only" },
});

number({
  min: { value: 18, message: "Must be adult" },
  max: { value: 120, message: "Unrealistic age" },
});
```

`message` option = fallback for all validation errors on that validator.\
`requiredMessage` option = message specifically for `null`/`undefined` input.

```ts
string({ message: "Invalid field", requiredMessage: "Field is required" });
object({ name: string() }, { requiredMessage: "Body is required" });
array(string(), { requiredMessage: "Tags required" });
```

---

## coerce(validator)

Wraps primitive validators to accept loose input. Apply at build time, not call
time.

```ts
coerce(string()); // String(val)
coerce(number()); // Number(val)
coerce(boolean()); // "true"/"1"/1 → true; "false"/"0"/0 → false
coerce(date()); // new Date(val)
coerce(bigint()); // BigInt(val)

// Compose freely
optional(coerce(number())); // undefined | number
nullable(coerce(date())); // null | Date
nullish(coerce(boolean())); // undefined | null | boolean
```

`coerce()` preserves `METADATA` from the inner validator.

### Coercion Rules by Type

| Type | Coerce behavior |
|---|---|
| `string` | `String(val)` |
| `number` | `Number(val)` — empty string throws |
| `boolean` | `true`/`"true"`/`1`/`"1"` → `true`; `false`/`"false"`/`0`/`"0"` → `false` |
| `date` | `new Date(val)` — invalid dates throw |
| `bigint` | `BigInt(val)` — floats and non-numeric strings throw |

---

## object(shape, options?)

Validates an object, strips extra keys, throws on invalid input. Returns a new
object with only the validated keys.

```ts
const schema = object({
  id: coerce(number()),
  name: string({ min: 2 }),
  role: optional(string()),
});

schema({ id: "1", name: "John", extra: "gone" });
// → { id: 1, name: "John" }

schema(null); // throws "Required"
schema("not-obj"); // throws "Invalid object"
schema({ id: "x" }); // throws 'Property "id": Invalid number: ...'
```

### Object Shorthand Syntax

Write nested objects/arrays/tuples directly in the shape. Normalized once at
construction time — zero per-call overhead.

```ts
// Plain object → object()
{ address: { city: string(), zip: string() } }
// → { address: object({ city: string(), zip: string() }) }

// [validator] → array()
{ tags: [string()] }
// → { tags: array(string()) }

// [v1, v2, ...] → tuple()
{ coords: [coerce(number()), coerce(number())] }
// → { coords: tuple([coerce(number()), coerce(number())]) }

// [{ shape }] → array(object({ shape }))
{ items: [{ id: coerce(number()), name: string() }] }
// → { items: array(object({ id: coerce(number()), name: string() })) }
```

Use `as const` assertion for tuple shorthand to get proper tuple type inference:

```ts
object({ pair: [string(), coerce(number())] as const });
```

### object().map(mapping)

Remaps where each property reads its value from. Called once at build time,
returns a new validator function.

```ts
const schema = object({
  name: string(),
  age: coerce(number()),
  role: string(),
}).map({
  age: "userAge", // read from input.userAge
  role: (data) => data.profile?.role, // compute from nested path
  // name: omitted → reads from input.name normally
});

schema({ name: "John", userAge: "30", profile: { role: "admin" } });
// → { name: "John", age: 30, role: "admin" }
```

### `.map()` Mapping Options per Key

| Value type | Behavior |
|---|---|
| `string` | Read from `input[altKey]` |
| `function` | Call `mapFn(input)` and pass result to validator |
| _(omitted)_ | Read from `input[key]` as normal |

`.map()` supports nesting and works alongside `optional`, `nullable`, `nullish`, `array`, and `union`:

```ts
object({
  profile: nullable(
    object({ bio: string() }).map({ bio: "biography" }),
  ),
});
```

---

## array(validator, options?)

```ts
array(string()); // array of strings
array(coerce(number())); // array of coerced numbers
array(object({ id: number() })); // array of objects
array(string(), { min: 1, max: 10 }); // length constraints
```

Error: `"Item at index 2: <inner message>"`

---

## tuple(validators, options?)

Fixed-length array. Each position has its own validator.

```ts
tuple([string(), coerce(number()), coerce(boolean())]);
// ["alice", "30", "true"] → ["alice", 30, true]

// Must match length exactly
// throws "Expected tuple of length 3, got 2"
```

---

## union(validators, options?)

First validator to succeed wins. Order matters.

```ts
union([number(), string()]); // number first
union([literal("a"), literal("b")]); // enum pattern
union([
  object({ type: literal("user"), id: number() }),
  object({ type: literal("guest"), token: string() }),
]); // discriminated union
```

Custom error: `union([...], { message: "Must be X or Y" })`

---

## literal(value, options?)

Exact value match. Types: `string`, `number`, `boolean`.

```ts
literal("admin");
literal(42);
literal(true, { message: "Must be true" });

// Enum pattern
const Status = union([
  literal("active"),
  literal("inactive"),
  literal("pending"),
]);
```

---

## optional / nullable / nullish

```ts
optional(validator); // undefined → undefined; null still throws
nullable(validator); // null → null; undefined still throws
nullish(validator); // undefined → undefined; null → null
```

Composition:

```ts
optional(nullable(string())); // undefined | null | string
nullish(coerce(number())); // undefined | null | number (coerced)
```

---

## pipe(validators, options?)

Runs validators left to right, each output feeds next input.

```ts
// Transform pipeline
const sanitize = pipe([
  string(),
  (s: string) => s.trim().toLowerCase(),
  string({ min: 3, pattern: /^[a-z0-9]+$/ }),
]);

// Parse pipeline
const parseJson = pipe([
  string(),
  (s: string) => JSON.parse(s),
  object({ id: number(), name: string() }),
]);

// Error override
pipe([string(), coerce(number())], { message: "Invalid input" });
```

Return type = last validator's return type. `METADATA` = last validator's
metadata.

---

## Async Variants

All async variants accept both sync and async validators in their shapes. Sync
validators run immediately; async validators run concurrently via `Promise.all`
(for object/array/tuple).

### objectAsync

```ts
const schema = objectAsync({
  name: string(), // sync
  slug: async (val) => slugify(string()(val)), // async
  unique: async (val) => { // async with side effect
    if (await db.exists(val)) throw new Error("Taken");
    return string()(val);
  },
});
const result = await schema({
  name: "john-doe",
  slug: "john-doe",
  unique: "john-doe",
});
```

### arrayAsync

```ts
const v = arrayAsync(async (id: any) => db.findUser(coerce(number())(id)));
const users = await v(["1", "2", "3"]); // all fetched concurrently
```

### tupleAsync

```ts
const v = tupleAsync([string(), asyncLookup, coerce(boolean())]);
const [a, b, c] = await v(["x", "id-1", "true"]);
```

### unionAsync

Tries each validator sequentially (awaits each):

```ts
const v = unionAsync([asyncPositive, string({ min: 3 })]);
```

### pipeAsync

```ts
const v = pipeAsync([
  string(),
  async (s) => s.trim(),
  async (s) => fetchEnriched(s),
]);
```

### Shorthand in objectAsync / arrayAsync

Works identically to sync:

```ts
objectAsync({
  id: string(),
  files: {
    images: [asyncSignUrl],
    documents: [string()],
    metadata: [{ size: coerce(number()), name: string() }],
  },
});
```

---

## Context (ctx) Forwarding

Every validator accepts `(val, ctx?)`. The `ctx` argument is forwarded
transparently through `object`, `array`, `tuple`, `optional`, `nullable`,
`nullish`, `union`, `pipe`, and all Async variants.

```ts
// Leaf validator using ctx
const cdnUrl = (val: any, ctx?: { region: string }) =>
  `https://cdn.example.com/${ctx?.region ?? "us"}/${string()(val)}`;

const schema = object({
  id: string(),
  assets: array(object({
    key: string(),
    url: cdnUrl,
  })),
});

// Pass ctx at the top level — it reaches all leaf validators
schema(rawData, { region: "eu-west" });
```

---

## Type Inference

```ts
import type { InferAsyncObject, InferObject } from "@coderbuzz/veta";

// From a shape (not wrapped in object())
const shape = { id: number(), name: string(), bio: optional(string()) };
type T = InferObject<typeof shape>;
// → { id: number; name: string; bio?: string | undefined }

// From the validator itself
const schema = object({ id: number(), name: string() });
type T2 = ReturnType<typeof schema>;

// Async
const asyncSchema = objectAsync({ id: number(), name: string() });
type T3 = Awaited<ReturnType<typeof asyncSchema>>;
```

Optional properties (those that can be `undefined`) are made optional (`?`) in
the inferred type automatically.

---

## METADATA Symbol

```ts
import { METADATA, type TypeMeta } from "@coderbuzz/veta";

const meta = (validator as any)[METADATA] as TypeMeta | undefined;
```

All primitive validators and composition helpers attach `TypeMeta` to the
validator function under `METADATA = Symbol.for("ken.metadata")`.

```ts
(string() as any)[METADATA] // { type: "string" }
(number() as any)[METADATA] // { type: "number" }
(boolean() as any)[METADATA] // { type: "boolean" }
(date() as any)[METADATA] // { type: "date" }
(bigint() as any)[METADATA] // { type: "bigint" }
(uint8array() as any)[METADATA] // { type: "uint8array" }
(any() as any)[METADATA] // { type: "any" }
(unknown() as any)[METADATA] // { type: "unknown" }
(literal("x") as any)[METADATA] // { type: "literal", value: "x" }
(optional(string()) as any)[METADATA] // { type: "optional", inner: { type: "string" } }
(nullable(number()) as any)[METADATA] // { type: "nullable", inner: { type: "number" } }
(nullish(boolean()) as any)[METADATA] // { type: "nullish", inner: { type: "boolean" } }
(array(string()) as any)[METADATA] // { type: "array", items: { type: "string" } }
(tuple([string(), number()]) as any)[METADATA] // { type: "tuple", items: [...] }
(union([string(), number()]) as any)[METADATA] // { type: "union", variants: [...] }
(object({ id: number() }) as any)[METADATA] // { type: "object", shape: { id: { type: "number" } } }
(coerce(number()) as any)[METADATA]; // { type: "number" } — preserved
```

Custom function validators have no `METADATA`. `pipe()` inherits from the last
validator in the chain.

---

## Error Message Reference

| Situation             | Default message                                   |
| --------------------- | ------------------------------------------------- |
| `null` / `undefined`  | `"Required"`                                      |
| Wrong primitive type  | `"Invalid string: expected string, got number"`   |
| `NaN`                 | `"Invalid number: expected number, got number"`   |
| String too short      | `"String too short (min: N)"`                     |
| String too long       | `"String too long (max: N)"`                      |
| Pattern mismatch      | `"String does not match pattern: /regex/"`        |
| Number too small      | `"Number too small (min: N)"`                     |
| Number too large      | `"Number too large (max: N)"`                     |
| Boolean invalid       | `"Invalid boolean: expected boolean, got string"` |
| Date too early        | `"Date too early (min: ISO)"`                     |
| Date too late         | `"Date too late (max: ISO)"`                      |
| Invalid Date          | `"Invalid date: \"not-a-date\""`                  |
| BigInt too small      | `"BigInt too small (min: N)"`                     |
| BigInt too large      | `"BigInt too large (max: N)"`                     |
| Uint8Array invalid    | `"Invalid Uint8Array"`                            |
| Not an object         | `"Invalid object"`                                |
| Not an array          | `"Invalid array"`                                 |
| Not a tuple           | `"Invalid tuple"`                                 |
| Tuple length mismatch | `"Expected tuple of length N, got M"`             |
| Union exhausted       | `"Value does not match any of the union types"`   |
| Literal mismatch      | `"Value must be exactly: \"value\""`              |
| Object property error | `"Property \"key\": <inner message>"`             |
| Array element error   | `"Item at index N: <inner message>"`              |

Errors nest:
`Property "users": Item at index 0: Property "email": String does not match pattern`

---

## Common Patterns

### Form / Query Parameter Parsing

```ts
const querySchema = object({
  page: coerce(number({ min: 1 })),
  limit: coerce(number({ min: 1, max: 100 })),
  active: coerce(boolean()),
  search: optional(string({ max: 200 })),
  from: optional(coerce(date())),
});
```

### Discriminated Union

```ts
const event = union([
  object({ type: literal("click"), x: number(), y: number() }),
  object({ type: literal("keyup"), key: string() }),
  object({ type: literal("scroll"), delta: number() }),
]);
```

### JSON Body Parsing + Validation

```ts
const parseBody = pipe([
  string(),
  (s: string) => JSON.parse(s),
  object({ id: coerce(number()), name: string() }),
]);
```

### Async with DB Uniqueness Check

```ts
const register = objectAsync({
  username: async (val) => {
    const name = string({ min: 3 })(val);
    if (await db.usernameExists(name)) throw new Error("Username taken");
    return name;
  },
  email: async (val) => {
    const email = string({ pattern: /@/ })(val).toLowerCase();
    if (await db.emailExists(email)) throw new Error("Email taken");
    return email;
  },
  password: string({ min: 8 }),
});
```

### Enum via Union of Literals

```ts
const Role = union([
  literal("admin"),
  literal("editor"),
  literal("viewer"),
], { message: "Invalid role" });
```

### Deep Nested with Shorthand

```ts
const adResponse = object({
  id: string(),
  ad: nullable({
    id: string(),
    creative: {
      url: string(),
      width: coerce(number()),
      height: coerce(number()),
    },
    track: {
      imp: [string()],
      revoke: [string()],
      progress: [{
        t: coerce(number()),
        url: string(),
      }],
    },
  }),
});
```

### Key Remapping with .map()

```ts
// API returns snake_case, schema uses camelCase
const schema = object({
  userId: coerce(number()),
  firstName: string(),
  lastName: string(),
  createdAt: coerce(date()),
}).map({
  userId: "user_id",
  firstName: "first_name",
  lastName: "last_name",
  createdAt: "created_at",
});
```

### Context for Multi-Tenant URL Building

```ts
const cdnUrl = (val: any, ctx?: { tenant: string }) =>
  `https://cdn.example.com/${ctx?.tenant}/${string()(val)}`;

const schema = object({
  id: string(),
  images: [cdnUrl],
  thumbnail: cdnUrl,
});

schema(data, { tenant: "acme-corp" });
```

### Pipeline with Transformation

```ts
const slugify = pipe([
  string(),
  (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
  string({ min: 1, max: 200, pattern: /^[a-z0-9-]+$/ }),
]);
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

## Complete Example

```ts
import {
  array, boolean, coerce, date, type InferObject,
  literal, nullable, number, object, optional, pipe, string, union,
} from "@coderbuzz/veta";

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
  address: optional(addressShape),       // shorthand — no object() needed
  tags: optional([string()]),            // shorthand — no array() needed
  scores: [coerce(number())],            // shorthand — always required
});

type User = InferObject<typeof userSchema>;

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
// { id: 42, name: "Jane Smith", email: "jane@example.com",
//   role: "admin", birthDate: null,
//   address: { street: "123 Main St", city: "Springfield", zip: "62701" },
//   tags: ["admin", "owner"], scores: [95, 87, 100] }
```

---

## Gotchas & Edge Cases

1. **`optional()` does NOT pass `null`** — use `nullable()` or `nullish()` for
   that.
2. **`nullable()` does NOT pass `undefined`** — use `nullish()` or `optional()`.
3. **`union()` order matters** — `union([coerce(string()), coerce(number())])`
   will always return a string because `coerce(string())` accepts everything.
4. **`coerce(number())` rejects empty strings** — `""` → "Invalid number".
5. **`coerce(bigint())` rejects floats** — `1.5` → "Invalid bigint".
6. **Object validators strip extra keys** — only declared shape keys are
   returned.
7. **`pipe()` metadata = last validator's metadata** — a custom function as the
   last step means no metadata.
8. **Shorthand tuple requires `as const`** for accurate TypeScript inference:
   `[string(), number()] as const`.
9. **`objectAsync()` runs async validators concurrently** — sync validators are
   resolved immediately, async validators run via `Promise.all`.
10. **`unionAsync()` is sequential** — it awaits each validator in order, unlike
    object/array which parallelize.
11. **`Buffer` passes `uint8array()`** — `Buffer extends Uint8Array`, so Node.js
    Buffer instances are accepted.
12. **Custom function validators have no METADATA** and no COERCE symbol —
    `coerce()` is a no-op on them.
13. **`.map()` is evaluated at call time on the whole object** — the mapping
    function receives the full input object, not the individual property value.

---

## Internal Behavior

### Validation Pipeline

Every validator follows a consistent lifecycle:

```
input → type check (strict/coerced) → constraint checks → return value
             ↓ invalid
          throw Error(message)
```

1. **Type check** — if value is `undefined`/`null`, throw `"Required"` (or `requiredMessage`). In coerce mode, attempt type conversion first.
2. **Constraint checks** — validate `min`, `max`, `pattern` etc. in deterministic order. First failure wins.
3. **Return** — validated (and possibly coerced/transformed) value.

### Shorthand Normalization

Happens once at schema construction time. The `shape` object is walked recursively:

```
shape entry → value type detection:
  ├─ Array<Validator> with 1 element     → array(elementValidator)
  ├─ Array<Validator> with >1 elements   → tuple(validators)
  ├─ Plain object (no call signature)    → object(shape)
  └─ Function                            → keep as-is (custom validator)
```

This means shorthand overhead is **zero at call time** — the normalized schema is identical to the fully-qualified version.

### Object Validation Pipeline

```
object({ a: validatorA, b: validatorB })(input, ctx)
  ├─ Check: is input an object? → else throw "Invalid object"
  ├─ For each declared key:
  │   └─ validator(input[key], ctx) → store result
  └─ Return new object with only validated keys (extra keys stripped)
```

Errors from nested properties include the key name: `Property "key": <inner message>`.

### Array Validation Pipeline

```
array(validator)(input, ctx)
  ├─ Check: is input an array? → else throw "Invalid array"
  ├─ Check min/max length constraints
  ├─ For each element:
  │   └─ validator(element, ctx) → store result
  └─ Return validated array
```

Errors from individual elements include the index: `Item at index N: <inner message>`.

### Async Concurrency Model

| Validator | Execution Strategy |
|---|---|
| `objectAsync` | All field validators run **concurrently** via `Promise.all` |
| `arrayAsync` | All element validators run **concurrently** via `Promise.all` |
| `tupleAsync` | All position validators run **concurrently** via `Promise.all` |
| `unionAsync` | Validators tried **sequentially** (each awaited before next) |
| `pipeAsync` | Validators run **sequentially** (each output feeds next input) |

Concurrent validators in `objectAsync`/`arrayAsync`/`tupleAsync` execute in parallel — a slow field/element does not block others.

### Context (ctx) Propagation

`ctx` is passed as the second argument to every validator in the tree:

```ts
schema(input, ctx)
  → object({ a: vA, b: object({ c: vC }) })(input, ctx)
    → vA(input.a, ctx)
    → object({ c: vC })(input.b, ctx)
      → vC(input.b.c, ctx)
```

All composition helpers (`optional`, `nullable`, `nullish`, `array`, `tuple`, `union`, `pipe`) forward `ctx`. The propagation is synchronous and zero-overhead — `ctx` is a direct argument, never stored or wrapped.

### METADATA Propagation Rules

| Wrapper | METADATA behavior |
|---|---|
| `coerce(validator)` | Preserves inner validator's metadata |
| `pipe(validators)` | Uses **last** validator's metadata |
| `optional(validator)` | `{ type: "optional", inner: <metadata> }` |
| `nullable(validator)` | `{ type: "nullable", inner: <metadata> }` |
| `nullish(validator)` | `{ type: "nullish", inner: <metadata> }` |
| Custom function | No metadata attached |

---

## TypeScript Types Quick Reference

```ts
// Infer output type from a shape object
type T = InferObject<{ id: typeof number; name: typeof string }>;

// Infer output type from a validator function
type T = ReturnType<typeof myObjectSchema>;

// Infer async output
type T = Awaited<ReturnType<typeof myAsyncSchema>>;

// ValidationRule — used in options
type ValidationRule<T> = T | { value: T; message: string };

// TypeMeta — attached to validators under METADATA symbol
type TypeMeta = { type: "string" } | { type: "number" } | /* ... */;

// ObjectValidator — has .map() method
type ObjectValidator<T> = {
  (val: any, ctx?: any): T;
  map(mapping: Partial<Record<keyof T, string | ((data: any) => any)>>): (val: any, ctx?: any) => T;
};
```
