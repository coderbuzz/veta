<!-- docs: sync from coderbuzz/codex@d0bc006 -->

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

Strict rejects: `null` → "Required", `undefined` → "Required", `123` → "Invalid
string: expected string, got number"

### number(options?)

```ts
number(); // strict: only number (not NaN)
number({ min: 0 }); // inclusive minimum
number({ max: 100 }); // inclusive maximum
number({ min: 1, max: 999 });
coerce(number()); // Number(val) — empty string throws
```

Strict rejects: `null`/`undefined` → "Required", `"123"` → "Invalid number",
`NaN` → "Invalid number"

### boolean(options?)

```ts
boolean(); // strict: only true/false
coerce(boolean()); // "true","1",1 → true; "false","0",0 → false
```

Strict rejects: `"true"` → "Invalid boolean: expected boolean, got string"

### date(options?)

```ts
date(); // strict: only Date instances
date({ min: new Date("2020-01-01") });
date({ max: new Date("2030-12-31") });
coerce(date()); // new Date(val) — parses ISO strings, timestamps
```

### bigint(options?)

```ts
bigint(); // strict: only bigint
bigint({ min: 0n });
bigint({ max: 9999n });
coerce(bigint()); // BigInt(val) — "123" → 123n; floats (1.5) throw
```

### uint8array(options?)

```ts
uint8array(); // only Uint8Array (Buffer is accepted, it extends Uint8Array)
uint8array({ min: 4 }); // min byte length
uint8array({ max: 256 }); // max byte length
// No coerce variant
```

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

Works at any nesting level and with `nullable`, `nullish`, `optional`, `array`,
`union`:

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
