<!-- docs: sync from coderbuzz/codex@a7c7bb5 -->

# VETA: AI Agent Knowledge File

**Package:** `@coderbuzz/veta` (no runtime dependencies)\
**Purpose:** Runtime-agnostic TypeScript schema validation library.\
**Distribution:** ESM only (`dist/index.js` + `dist/index.d.ts`). No source
`.ts` files in the package.

---

## Mental Model

`veta` validators are **plain functions** with the signature
`(val: any, ctx?: any) => T`. They throw `VetaError` on invalid input and return the
validated value on success. **Only a `VetaError` means "invalid input"**: anything
else a validator throws (a bug, a database outage) propagates unchanged through
every compound and through `safeParse`, so it becomes a 500, not a 400. Custom
validators must report bad input with `throw new VetaError(message, { code })`. Every function exported from `@coderbuzz/veta` either
**creates** a validator function or **wraps** one, except `safeParse` /
`safeParseAsync`, which run one.

```
validator = (val: any, ctx?: any) => T    // throws on invalid, returns T on valid
```

---

## Why Veta over Zod, Yup, or Joi?

| Pain Point | Zod | Yup | Joi | **Veta** |
|---|---|---|---|---|
| Nested object syntax | Must wrap every level with `z.object()` | Same | Same | **Shorthand**: plain objects auto-detect |
| Type coercion | `z.coerce.xxx()` or custom transforms | `.cast()` only | Separate module | **Built-in `coerce()`**, one function |
| Async validation | Manual promise chaining | Separate `YupSchema` | `Joi.any().custom()` | **Mirror API**: `objectAsync`, `arrayAsync`, etc. |
| Context / request-scoped data | Not supported | Not supported | Not supported | **`ctx` forwarding** through every level |
| Schema metadata | `z.ZodType` internals only | None | `.describe()` | **`METADATA` symbol**: use for codecs/serialization |
| Bundle size | ~35 KB min+gzip | ~20 KB | ~50 KB+ | **~9.5 KB min+gzip** (whole library), zero deps |

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
// Zod: every level needs wrapping
const zodSchema = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      tags: z.array(z.string()),
    }),
  }),
});

// Veta: shorthand auto-detects nested objects and arrays
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

// Veta: a field validator is itself the async function, fields run concurrently
const checkUsername = async (val: unknown) => {
  const name = string({ min: 3 })(val);
  const exists = await db.users.exists({ name });
  if (exists) throw new VetaError("Username already taken", { code: "taken" });
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
  check,
  checkAsync,
  coerce,
  date,
  decimal,
  discriminatedUnion,
  flattenIssues,
  isoDate,
  isVetaError,
  lazy,
  picklist,
  record,
  refine,
  refineAsync,
  withDefault,
  withMeta,
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
  safeParse,
  safeParseAsync,
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
  withContext,
  VetaError,
  type ValidationRule,
  // Other exported types
  type VetaIssue,
  type VetaIssueCode,
  type VetaErrorOptions,
  type SafeParseResult,
  type SafeParseOptions,
  type FlattenedIssues,
  type RefineIssue,
  type IsoDateOptions,
  type AsyncObjectValidator,
  type ContextualValidator,
  type DecimalOptions,
  type ObjectOptions,
  type ObjectValidator,
} from "@coderbuzz/veta";
```

Not exported: the per-primitive option types (`StringOptions`, `NumberOptions`,
`BooleanOptions`, `DateOptions`, `BigIntOptions`), `ContainsUndefined`, and the
internal `COERCE` symbol (`Symbol.for('coderbuzz.veta.coerce')`).

```ts
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
coerce(string()); // strings, finite numbers, bigints, booleans as text; objects/arrays/dates throw
string({ trim: true, length: 3 }); // trim before checks (returns trimmed); exact length
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<number>` | Minimum string length (inclusive) |
| `max` | `ValidationRule<number>` | Maximum string length (inclusive) |
| `pattern` | `ValidationRule<RegExp>` | Regex pattern to test against |
| `message` | `string` | Fallback message for all validation errors |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

Strict rejects: `null` → "Required", `undefined` → "Required", `123` → "Invalid string: expected string, got number"

**`pattern` flags.** A validator closes over one RegExp object for its whole
lifetime, and `RegExp.prototype.test()` on a `/g` or `/y` regex mutates that
object's `lastIndex`. The same input would then pass on one call and fail on the
next, with the parity depending on how much unrelated traffic the process has
served: invisible in a unit test that calls once, and reproducible only in
production. So the flags are handled when the validator is constructed:

- `/g` is stripped (a whole-string match never needed it); other flags survive,
  e.g. `/^inv-\d+$/gi` keeps `i`.
- `/y` throws from `string()` itself, since sticky also changes where the match
  starts, so stripping it would silently change the pattern's meaning.
- The rewritten regex is what appears in the default
  `String does not match pattern: ...` message.

### number(options?)

```ts
number(); // strict: only finite numbers
number({ min: 0 }); // inclusive minimum
number({ max: 100 }); // inclusive maximum
number({ min: 1, max: 999 });
coerce(number()); // number, or a decimal string, see below
```

**Rejects every non-finite value**, strict and coerced: `NaN`, `Infinity`,
`-Infinity` → `Invalid number: expected a finite number, got <value>`. `min`/`max`
are not a substitute: `Infinity >= 0`, so a lower bound alone lets it through,
and lower-bound-only is the usual shape of an amount field.
`JSON.parse('{"amount":1e400}')` produces `Infinity` with no error at all, so the
value reaches the validator directly from a request body; once it is in an
arithmetic chain, `Infinity - Infinity` is `NaN` and every aggregate touching
that row is poisoned. `coerce(number())("1e400")` is rejected for the same
reason.

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
coerce(date()); // Date, epoch ms, or a string starting with an existing YYYY-MM-DD; "2024-02-31", true, "1" throw
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
coerce(bigint()); // integer string (trimmed) or safe integer: "123" → 123n; "", [], true, "0x10", 1.5 throw
```

| Option | Type | Description |
|---|---|---|
| `min` | `ValidationRule<bigint>` | Minimum value (inclusive) |
| `max` | `ValidationRule<bigint>` | Maximum value (inclusive) |
| `message` | `string` | Fallback message |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

### decimal(options?)

The validator for money. Accepts a `string` or `bigint`, returns a **normalized
string**, never a `number`.

```ts
decimal();                              // any decimal string
decimal({ scale: 2 });                  // at most 2 fraction digits, padded to 2
decimal({ precision: 18, scale: 2 });   // NUMERIC(18, 2)
decimal({ scale: 2, min: '0.00' });     // non-negative amounts
coerce(decimal({ scale: 2 }));          // additionally accepts safe integers
```

| Option | Type | Description |
|---|---|---|
| `scale` | `ValidationRule<number>` | Maximum fraction digits; output padded to exactly this many |
| `precision` | `ValidationRule<number>` | Maximum total digits (integer + fraction) |
| `min` | `ValidationRule<string>` | Inclusive minimum, as a decimal string |
| `max` | `ValidationRule<string>` | Inclusive maximum, as a decimal string |
| `message` | `string` | Fallback message |
| `requiredMessage` | `string` | Message when value is `undefined` or `null` |

**Accepted shape:** `/^-?\d+(\.\d+)?$/`. No exponent form, no thousands
separator, no leading `+`, no bare `.5` or `5.`, and no `NaN`/`Infinity`: a
column that stores money has no use for any of them.

**Normalization**, so that two equal amounts are always the same string:

| Input | `decimal()` | `decimal({ scale: 2 })` |
|---|---|---|
| `'007.50'` | `'7.50'` | `'7.50'` |
| `'1234'` | `'1234'` | `'1234.00'` |
| `'1234.5'` | `'1234.5'` | `'1234.50'` |
| `'-0.00'` | `'-0.00'` → `'0.00'` | `'0.00'` |
| `'1234.567'` | `'1234.567'` | throws |

Without `scale` the fraction is left as written, so `'1.5'` and `'1.50'` stay
different strings. Declare `scale` whenever you intend to compare or key on the
value.

**Rejected, not rounded.** More fraction digits than `scale` is an error. The
caller had precision the column cannot store, and quietly discarding part of it
is the failure the validator exists to prevent.

**Bounds** are compared exactly, by aligning both scales and comparing as
`BigInt`, so `decimal({ max: '9007199254740993' })` still rejects
`'9007199254740994'`, which a float64 comparison would let through because both
sides collapse to the same value.

**Why not `number()`:** `0.1 + 0.2` is `0.30000000000000004`, `9007199254740993`
becomes `9007199254740992`, and float addition is order-dependent: the same
journal rows can sum to a different total depending on how the query ordered
them, so `total debit === total credit` holds or fails unpredictably for large
values. `min` does not catch it either, since the loss happens before validation.

**Strict mode rejects `number` outright**, with a message that says why.
`coerce(decimal())` accepts a `number` only when it is a safe integer
(`Number.isSafeInteger`); a fractional or unsafe one is refused rather than
stringified, because stringifying it would make a lost digit look exact.

**Interop.** `@coderbuzz/sql` infers `SqlColumn<string>` for `DECIMAL`,
`NUMERIC`, `BIGINT`, `BIGSERIAL` and MSSQL `MONEY`, and `pg`/`mysql2` return
those columns as strings already. Using `decimal()` at the HTTP edge means the
same representation end to end, with no conversion at the boundary. `METADATA`
is `{ type: 'string' }`, so `@coderbuzz/proto` serializes it as a string.

Arithmetic is not veta's job. Do it in SQL (`SUM`, `*`, `ROUND` on `NUMERIC` are
exact) or in a decimal library, and pass values back as strings.

**No `money()` alias**, deliberately: the right scale is a property of the
currency (IDR is usually 0, most are 2, some are 3) and of the target column.

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

## Custom Error Messages: ValidationRule<T>

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
coerce(string()); // scalars only
coerce(number()); // number, or a decimal string
coerce(boolean()); // "true"/"1"/1 → true; "false"/"0"/0 → false
coerce(date()); // Date | epoch ms | "YYYY-MM-DD..." string
coerce(bigint()); // integer text or safe integer
coerce(decimal({ scale: 2 })); // string, bigint, or a safe integer

// Compose freely
optional(coerce(number())); // undefined | number
nullable(coerce(date())); // null | Date
nullish(coerce(boolean())); // undefined | null | boolean
```

`coerce()` preserves `METADATA` from the inner validator.

### coerce() is not a no-op any more

`coerce()` throws at construction for any validator that does not define a
coerced form: `object`, `array`, `tuple`, `union`, `literal`, `uint8array`, and
every custom validator. Only `string`, `number`, `boolean`, `date`, `bigint` and
`decimal` are coercible.

It used to return the validator unchanged. `coerce(object({ amount: number() }))`
reads as though it coerces into the shape; it did nothing, and the strict
`number()` inside rejected every form value, loud enough to catch in
development. The quiet one was `coerce(union([number(), string()]))`: no
coercion happened, the union still matched via its `string()` branch, so a value
that should have become a number flowed on as a string while TypeScript saw
`number | string` and was satisfied.

The fix is to coerce the fields, not the composite:
`object({ amount: coerce(number()) })`.

### object({ unknownKeys })

```ts
object(shape, { unknownKeys?: 'strip' | 'error' | 'passthrough' })
```

- `'strip'` (default): unchanged, keys the shape does not mention are dropped.
- `'error'`: reject, naming them; `issues` gets one `{ path: [key] }` entry each.
- `'passthrough'`: copy them onto the result unvalidated. They appear at
  runtime but not in the inferred type: the shape never mentioned them, so
  TypeScript has nothing to infer from. Cast, or declare them.

The default path never walks the input's own keys, so `'strip'` costs nothing.

Why `'error'` exists: on `PATCH /journal-entries/:id` with a partial schema,
`{ "memmo": "audit correction" }` (a typo for `memo`) validates cleanly to
`{}` under `'strip'`, the update changes nothing, and the API answers 200. The
user believes the note was saved; there is no error, no log and no trace. For
records with audit consequences, succeeding while doing nothing is worse than
failing.

Note that `object()` reads declared properties off whatever it is given,
including class instances, so it does not assert "plain data object".

### Coercion Rules by Type

| Type | Coerce behavior |
|---|---|
| `string` | a string; a finite number, bigint or boolean as text. Objects, arrays, dates, functions, symbols throw |
| `number` | a `number`, or a `string` matching `/^[+-]?(\d+(\.\d*)?\|\.\d+)([eE][+-]?\d+)?$/` after trimming. Everything else throws, see below |
| `boolean` | `true`/`"true"`/`1`/`"1"` → `true`; `false`/`"false"`/`0`/`"0"` → `false` |
| `date` | a `Date`, finite epoch ms, or a string that starts with an existing `YYYY-MM-DD` (then end, `T` or space). Non-calendar dates (`2024-02-31`) throw instead of rolling over |
| `isoDate` | trims whitespace |
| `bigint` | an integer string (optional sign, trimmed) or a safe-integer number. `""`, `[]`, `true`, `"0x10"`, `1.5`, `2**60` throw |
| `decimal` | a decimal `string`, a `bigint`, or a **safe integer** `number`; a fractional number throws |

**`number` used to be `Number(val)`**, which inherits every JavaScript conversion
quirk, on the path query strings and form data take: the least trusted input
there is. What it accepted:

| Input | Was | Now |
|---|---|---|
| `[]` | `0` | throws |
| `[5]` | `5` | throws |
| `true` | `1` | throws |
| `'0x10'` | `16` | throws |
| `'1e400'` | `Infinity` | throws |
| `'  12  '` | `12` | `12`, whitespace is trimmed |
| `'12abc'` | throws | throws |

`[]` is the one that mattered. A query parser that yields an array for a
repeated parameter (`?amount=&amount=`) produced `[]`, which became a silent
`0`: a payment field that should have failed validation recorded as a zero
payment. The transaction is created, debit still equals credit, and nothing
reports an error: a class of bug found at bank reconciliation, not at request
time.

---

## object(shape, options?)

Validates an object, throws on invalid input. Returns a new object with the
validated keys; keys the shape does not mention are dropped by default. See
`unknownKeys` above to reject or keep them instead.

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
construction time, zero per-call overhead.

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

**`.map()` and `unknownKeys`/metadata:** the returned validator keeps the
object's `METADATA` and honours `unknownKeys`, checked against the input keys it
reads (a string mapping `{ a: "alpha" }` makes `alpha` known). A function
mapping can read anything, so `.map()` throws at definition when `unknownKeys` is
not `'strip'` and any key is function-mapped.

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
picklist(["a", "b"]); // enum: use this, not union([literal("a"), literal("b")]) (~190x faster, clearer error)
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

**Mixed sync/async failure.** When a sync validator throws while async siblings
are still pending, the container rejects with the sync error. `Promise.all` is
never reached. The pending children are given a no-op rejection handler first,
so a child that also fails does not surface as an unhandled rejection (which
Node terminates the process for by default, and which would carry no request or
tenant context in the log). Only the first sync failure is reported when the validator is called directly;
use `safeParseAsync` to collect every failure.

### objectAsync

Options: the same `ObjectOptions` as `object()`, including `unknownKeys` (checked
before any async child runs). Returns an `AsyncObjectValidator<T>` with `.map()`,
`.shape`, `.partial()`, `.pick()`, `.omit()`, `.extend()`. All async variants
carry the same `METADATA` as their sync counterparts.

```ts
const schema = objectAsync({
  name: string(), // sync
  slug: async (val) => slugify(string()(val)), // async
  unique: async (val) => { // async with side effect
    if (await db.exists(val)) throw new VetaError("Taken", { code: "taken" });
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

The `ctx` argument is forwarded transparently through the **compound**
validators: `object`, `array`, `tuple`, `optional`, `nullable`, `nullish`,
`union`, `pipe`, and all Async variants.

The built-in **leaf** validators take one argument and ignore any context:
`string`, `number`, `boolean`, `date`, `bigint`, `decimal`, `uint8array` and
`literal` are all arity 1 (`literal('x').length === 1`). They have no children
to forward to and no use for it. JavaScript ignores the extra argument, so
passing one is harmless: it simply does nothing. Context is read by *your*
validators, and `withContext()` makes a missing one a `VetaError` instead of a
`TypeError`.

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

// Pass ctx at the top level, it reaches all leaf validators
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

| Type | Description |
|---|---|
| `InferObject<S>` | Output type of a sync object **shape** (not of an `object()` validator) |
| `InferAsyncObject<S>` | Output type of an async object shape (unwraps `Promise`) |
| `InferEntry<T>` | Output type of one shape entry: a validator instance, plain object, `[v]` or `[v1, v2]` |
| `InferAsyncEntry<T>` | Async counterpart of `InferEntry` |
| `ValidationRule<T>` | `T \| { value: T; message: string }` |
| `TypeMeta` | Discriminated union describing a validator's shape |

Pass validator **instances**, not factories: `InferEntry<typeof tag>` with
`const tag = string()` is `string`; `InferEntry<typeof string>` is the validator
function type. Passing an `object()` validator to `InferObject` gives a wrong
type too; use `ReturnType<typeof schema>`.

---

## METADATA Symbol

```ts
import { METADATA, type TypeMeta } from "@coderbuzz/veta";

const meta = (validator as any)[METADATA] as TypeMeta | undefined;
```

All primitive validators and composition helpers (sync and async) attach
`TypeMeta` to the validator function under
`METADATA = Symbol.for("coderbuzz.veta.metadata")`. Custom functions,
`withContext()` (unless given `{ meta }`) and `lazy()` attach none; describe one
with `withMeta(validator, meta)`.

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
(record(string(), number()) as any)[METADATA] // { type: "record", key: { type: "string" }, value: { type: "number" } }
(coerce(number()) as any)[METADATA]; // { type: "number" }, preserved
(decimal() as any)[METADATA] // { type: "string" }
(isoDate() as any)[METADATA] // { type: "string" }
(picklist(["a", "b"]) as any)[METADATA] // { type: "union", variants: [{ type: "literal", value: "a" }, ...] }
(withMeta(fn, { type: "string" }) as any)[METADATA] // { type: "string" }
```

Custom function validators have no `METADATA`. `pipe()` inherits from the last
validator in the chain.

**Missing child metadata is all or nothing (VETA-26):** `array`, `optional`,
`nullable`, `nullish`, `withDefault`, `refine`, `check` get none if the inner
validator has none; `object`, `tuple`, `union`, `discriminatedUnion`, `record`
get none unless every child has it. `object()` used to describe only the fields that had
metadata, and a proto codec built from it silently dropped the others on
encode. `proto()` now refuses such a schema and points at `withMeta`.

---

## VetaError: Custom Error Class

All validators throw `VetaError` (extends `Error`) on invalid input:

```ts
import { VetaError, string } from "@coderbuzz/veta";

try {
  string({ min: 3 })(input);
} catch (err) {
  if (err instanceof VetaError) {
    err.name;    // "VetaError"
    err.message; // "String too short (min: 3)"
    err.path;    // [], empty for primitives, populated in compound validators
  }
}
```

### VetaError API

| Property  | Type                     | Description                                         |
|-----------|--------------------------|-----------------------------------------------------|
| `name`    | `"VetaError"`            | Always `"VetaError"`, use for `err.name` checks    |
| `message` | `string`                 | Human-readable error description                    |
| `path`    | `(string \| number)[]`   | Structured traversal path to the failing field      |
| `issues`  | `VetaIssue[]`            | Why a composite gave up; `[]` for a leaf failure    |
| `code`    | `VetaIssueCode \| string`| Machine-readable reason (`'too_small'`, ...); `'custom'` by default |
| `params`  | `Record<string, unknown> \| undefined` | Values for a translated message, JSON-safe |
| `reason`  | `string`                 | `message` without the `Property "x": ` prefixes      |
| `toIssue()` | `() => VetaIssue`      | This failure as an issue                            |
| `toJSON()`  | `() => object`         | `{ name, message, code, path, params?, issues? }`   |

Constructor: `new VetaError(message, { path?, code?, params?, issues?, reason? })`,
or the older positional `new VetaError(message, path?, issues?)`.
`err instanceof VetaError` and `isVetaError(err)` recognise errors from **any
copy** of veta (shared `Symbol.for('coderbuzz.veta.error')` brand), which
matters because a veta bundled twice has two classes. Subclasses keep ordinary
`instanceof`.

`issues` is populated by `union()` (one entry per variant tried, each prefixed
`Variant N:` and carrying that variant's own path and code), by `pipe()` when a
custom message replaces the stage's error, by `object({ unknownKeys: 'error' })`
(one `unknown_key` per key), and by `check()` when it reports several issues.
Everything else leaves it empty. Nested issue paths are relative to the parent.

Before, `union()` caught its children with a bare `catch` and threw
`'Value does not match any of the union types'` with an empty path and no cause.
For a payment-method union, the support ticket said nothing about which variant
came closest, which field was wrong, or that the problem was the card number.
Answering it meant reproducing with the user's payload.

The `path` property tracks where the failure occurred in nested schemas:

```ts
const schema = object({
  users: array(object({
    email: string({ pattern: /@/ }),
  })),
});

try {
  schema({ users: [{ email: "alice@x" }, { email: "bob" }] });
} catch (err) {
  if (err instanceof VetaError) {
    err.message; // 'Item at index 1: Property "email": String does not match pattern: /@/'
    err.path;    // ['users', 1, 'email']
  }
}
```

Path segments:
- Object keys → `string` (e.g. `"email"`, `"name"`)
- Array/tuple indices → `number` (e.g. `0`, `1`)
- Primitive validators → empty array `[]`

### Catching VetaError in HTTP Frameworks

```ts
try {
  return schema(req.body);
} catch (err) {
  if (err instanceof VetaError) {
    ctx.status(400);
    return { error: err.reason, code: err.code, path: err.path };
  }
  throw err; // a bug or an outage: let the framework log it and answer 500
}
```

Before 0.5.0 compound validators wrapped **every** error in a `VetaError`, so the
second branch was unreachable for anything thrown inside a schema: a DB outage
in an async check became a 400 containing `connect ECONNREFUSED <internal IP>`.

Since `VetaError` extends `Error`, existing `toThrow()` tests continue to work.

## safeParse: every failure, not just the first

```ts
safeParse<T>(validator, value, ctx?, options?: { maxIssues?: number }):
  | { ok: true; value: T }
  | { ok: false; issues: VetaIssue[]; truncated: boolean }

safeParseAsync<T>(validator, value, ctx?, options?): Promise<...>   // async schemas

interface VetaIssue {
  readonly path: (string | number)[];
  readonly message: string;                    // unprefixed
  readonly code: VetaIssueCode | (string & {});
  readonly params?: Readonly<Record<string, unknown>>;  // JSON-safe
  readonly issues?: VetaIssue[];               // union variants, pipe original, check() extras
}

flattenIssues(issues): { formErrors: string[]; fieldErrors: Record<string, string[]> } // 'lines.0.amount'
```

`maxIssues` stops collection at N issues (`truncated: true`); set it on endpoints
accepting large arrays. A non-`VetaError` thrown by any validator is re-thrown,
never reported as an issue.

```ts
const result = safeParse(journal, { ref: 'x', lines: [{ account: 1, amount: '10.005' }] });
if (!result.ok) {
  result.issues;
  // [
  //   { path: ['ref'],                 code: 'too_small',     message: 'String too short (min: 3)', params: { min: 3, type: 'string' } },
  //   { path: ['lines', 0, 'account'], code: 'invalid_type',  message: 'Invalid string: expected string, got number', params: {...} },
  //   { path: ['lines', 0, 'amount'],  code: 'invalid_scale', message: 'Too many fraction digits (max: 2)', params: { scale: 2 } },
  // ]
}
```

**How it works.** Compound validators take an optional third argument, an
internal collector. `safeParse` supplies one; `object`, `array`, `tuple`,
`record`, `discriminatedUnion`, `pipe`, `refine`/`check`, their async variants
and the `optional`/`nullable`/`nullish`/`withDefault`/`lazy`/`withMeta`/`withContext`
wrappers then record each child's failure and keep going instead of rethrowing. Without a collector,
which is every call that is not `safeParse`, they take exactly the path they
always took, and the cost is one `undefined` check per compound.

**`issue.message` has no prefix.** It is the leaf validator's own message, not
`Property "lines": Item at index 0: ...`. The path carries the location, and a
form wants the two separately.

**What stays a leaf, contributing one issue rather than several:**
- `union()`: no single child to attribute a failure to (its issue carries the
  variants' failures in `issues`); use `discriminatedUnion` for tagged variants
- your own validators: they do not know about the collector

`pipe()` passes the collector to each stage and stops after a stage that
recorded issues. `refine`/`check` rules run only when the wrapped validator
recorded none. `array({ min })` records the length issue and still checks the
items; `array({ max })` records it and does not.

**Async collection settles rather than races.** In collect mode
`objectAsync`/`arrayAsync`/`tupleAsync` await every child and report all the
failures, instead of rejecting on the first. Each child gets its own collector
seeded with its path, because those children run concurrently and a shared path
stack would interleave.

**Partial results.** On failure only `issues` is returned; the partially-built
value is not exposed, since half a journal entry is not something to act on.

**Throwing is unchanged.** Calling a validator directly still stops at the first
failure with the prefixed message and `VetaError.path`. `safeParse` is additive.

## withContext: validators that need request-scoped data

```ts
withContext<T, C>(fn: (val: any, ctx: C) => T, options?: { message?: string; meta?: TypeMeta }): (val: any, ctx?: C) => T
type ContextualValidator<T, C> = (val: any, ctx?: C) => T
```

```ts
type AppCtx = { tenantId: string };

const accountCode = withContext<string, AppCtx>((val, ctx) => {
  const code = string({ min: 1 })(val);
  if (!accountsOf(ctx.tenantId).has(code)) throw new VetaError('Unknown account');
  return code;
});

accountCode('1000');                        // VetaError: requires a context
accountCode('1000', { tenantId: 'acme' });  // '1000'
safeParse(schema, body, { tenantId: 'acme' });  // ctx reaches it through the schema
```

**The problem it bounds.** Every validator is `(val: any, ctx?: any)`. `ctx` is
optional and `any`, so nothing tells a caller that a validator needs one and
nothing fails when they forget. At runtime that becomes either `ctx.tenantId`
throwing a `TypeError`, which is not a `VetaError`, so it escapes the
validation error handler and surfaces as a 500; or, for a validator written
defensively as `ctx?.tenantId`, a lookup against `undefined`: every account
rejected, or, depending on the implementation, every account accepted, which is
a cross-tenant leak.

`withContext` makes the third outcome impossible: no context, no validation. The
failure is a `VetaError` with a path, so it lands in the same handler as every
other validation failure.

**What this is not.** `ctx` is still `any` across the rest of the library.
Making it generic on `object<S, C>` and threading `C` through every validator
signature was considered and not done: it touches every signature and every
inference path, `InferObject` already carries a note about TS2589 recursion
depth, and it would be a breaking change to type inference for existing schemas.
`withContext` types the context where it is actually read, which is where
getting it wrong costs something.

It forwards the collector to `fn`, so a `withContext` wrapping an `object()`
still collects. Pass `{ meta }` to give it metadata.

**Tenancy should not rest on this.** The audit's conclusion in section 2C holds:
`ctx` is a convenience, not an enforcement boundary. Enforce tenant isolation in
the database (row-level security via `SET LOCAL`), and treat a context-aware
validator as a better error message, not as the control.

### Error Message Reference

| Situation             | Default message                                   |
| --------------------- | ------------------------------------------------- |
| `null` / `undefined`  | `"Required"`                                      |
| Wrong primitive type  | `"Invalid string: expected string, got number"`   |
| `NaN` / `Infinity`    | `"Invalid number: expected a finite number, got NaN"` |
| Coerced number text   | `"Invalid number: \"0x10\""`                        |
| Decimal shape         | `"Invalid decimal: \"1e5\" is not a decimal number"` |
| Decimal scale         | `"Too many fraction digits (max: N)"`             |
| Decimal precision     | `"Too many digits (max: N)"`                      |
| Decimal bounds        | `"Decimal too small (min: X)"` / `"Decimal too large (max: X)"` |
| Unknown keys          | `"Unknown key: \"k\""` / `"Unknown keys: \"a\", \"b\""` |
| `withContext` no ctx  | `"This validator requires a context, and none was passed. ..."` |
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
| Picklist mismatch     | `"Expected one of: \"a\", \"b\""`                  |
| Discriminator         | `"Property \"kind\": Expected one of: \"a\", \"b\""` |
| Record key            | `"Key \"k\": <inner message>"`                     |
| String exact length   | `"String must be exactly N characters"`           |
| Not an integer        | `"Invalid number: expected an integer, got 1.5"`  |
| isoDate format        | `"Invalid date: \"2024-2-9\" is not in YYYY-MM-DD format"` |
| Non-calendar date     | `"Invalid date: \"2024-02-31\" is not a calendar date"` |
| Object property error | `"Property \"key\": <inner message>"`             |
| Array element error   | `"Item at index N: <inner message>"`              |

Errors nest:
`Property "users": Item at index 0: Property "email": String does not match pattern`

---

## Issue codes

Every `VetaError` and `VetaIssue` has a `code`; read `code`/`params`, never
`message`, to translate or branch. `params` are JSON-safe (dates → ISO strings,
bigints → strings).

| Code | Source | `params` |
|---|---|---|
| `required` | `undefined`/`null` | |
| `invalid_type` | wrong type, un-coercible input | `{ expected, received }` |
| `invalid_format` | `pattern`, bad number/decimal/date/integer text | `{ format, pattern? }` |
| `invalid_date` | non-calendar date, invalid `Date` | |
| `too_small` / `too_big` | `min` / `max` | `{ min \| max, type }` (`type`: string, number, array, date, bigint, decimal, uint8array) |
| `invalid_length` | `string({ length })`, tuple length | `{ length, type }` |
| `not_finite` | `NaN`, `±Infinity` | |
| `not_integer` | `number({ integer })`, unsafe int in `coerce(bigint())` | |
| `invalid_scale` / `invalid_precision` | `decimal()` | `{ scale }` / `{ precision }` |
| `invalid_literal` | `literal()` | `{ expected }` |
| `invalid_enum` | `picklist()` | `{ options }` |
| `invalid_union` | `union()` | (variants in `issues`) |
| `invalid_discriminator` | `discriminatedUnion()` | `{ key, options }` |
| `invalid_key` | `record()` key | |
| `unknown_key` | `unknownKeys: 'error'` | `{ keys }` on the thrown error |
| `context_required` | `withContext()` without ctx | |
| `custom` | your `VetaError`s without a code; `refine`/`check` without one | |

---

## Added in 0.5.0: reference

```ts
// Primitives
isoDate(options?: { min?: ValidationRule<string>; max?: ValidationRule<string>; message?; requiredMessage? })
  // 'YYYY-MM-DD' string in, same string out; calendar-checked; coerce trims. Use for posting/due dates.
string({ trim?: boolean; length?: ValidationRule<number>; ... })
number({ integer?: ValidationRule<boolean>; ... })   // safe integer

// Choices
picklist(['draft', 'posted', 'void'], { message?, requiredMessage? }) // no 'as const' needed // => 'draft' | 'posted' | 'void'
discriminatedUnion('kind', [object({ kind: literal('a'), ... }), object({ kind: picklist(['b','c']), ... })], { message?, requiredMessage? })
  // variants must be object()/objectAsync() whose key field is literal()/picklist(); checked at definition

// Structure
record(keyValidator, valueValidator, { message?, requiredMessage? })  // Partial<Record<K,V>> for finite K; rejects __proto__
lazy(() => validator)                         // recursive schemas; no metadata
withDefault(validator, value | () => value)   // only for undefined; fallback not validated
withMeta(validator, meta)                     // describe a custom validator for proto
object(shape).shape / .partial(...keys?) / .pick(...keys) / .omit(...keys) / .extend(shape)

// Rules about the whole value (run only if the value itself passed)
refine(validator, (value, ctx) => boolean, string | { message, path?, code?, params? })
check(validator, (value, report, ctx) => void)   // report({ message, path?, code?, params? }) as often as needed
refineAsync / checkAsync                          // same, rule may await

// Async
arrayAsync(validator, { concurrency?: number, ... })   // bound concurrent work

// Errors
isVetaError(err)                                  // same as err instanceof VetaError, across veta copies
flattenIssues(issues)                             // { formErrors, fieldErrors: { 'a.0.b': [...] } }
safeParse(v, value, ctx?, { maxIssues? })         // result.truncated when the limit stopped it
```

### Detailed behavior of the 0.5.0 additions

**`isoDate(options?)`**
- Strict: input must be a `string` matching `^\d{4}-\d{2}-\d{2}$` exactly (zero-padded, no time part, no whitespace). Coerce: same after `.trim()`. A `Date` is rejected in both modes (`invalid_type`); there is no Date → string conversion because the right timezone for it is unknowable.
- Calendar check: month 1–12, day within the month, leap years by the Gregorian rule (`2024-02-29` ok, `2023-02-29` and `1900-02-29` rejected, `2000-02-29` ok).
- `min`/`max` are validated at definition (must themselves be calendar dates, else `Error` at construction) and compared as strings, which is correct because the format is fixed-width.
- Messages: `Invalid date: expected a 'YYYY-MM-DD' string, got <typeof>`, `Invalid date: "<v>" is not in YYYY-MM-DD format`, `Invalid date: "<v>" is not a calendar date`, `Date too early (min: <min>)`, `Date too late (max: <max>)`.

**`coerce(date())` accepted inputs, exactly**
- `Date` (returned as the same instance, then `min`/`max` checked; an invalid Date → `invalid_date`).
- `number`: must be finite; `new Date(n)`; out-of-range epoch (e.g. `1e20`) → `invalid_date`.
- `string`: trimmed; must match `^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])`; the date part must be a calendar date; then `new Date(text)` must not be Invalid (so `2024-01-15T25:00` fails). Date-only strings parse as **UTC midnight**; date-time strings without an offset parse as **local time** (JavaScript's rule).
- Anything else (`boolean`, arrays, objects) → `invalid_type`.

**`string({ trim, length })`**
- `trim` is applied first, then `length` → `min` → `max` → `pattern`, in that order; the first failing check throws. The **trimmed** value is returned.
- In coerce mode, the text form is produced first (`String(n)` for finite numbers/bigints/booleans), then trimmed.

**`number({ integer })`**
- `Number.isSafeInteger` check, applied before `min`/`max`. Two messages, one code (`not_integer`): `expected an integer, got 1.5` and `<n> is beyond the safe integer range (2^53-1)`. `integer: { value: true, message }` overrides both.

**`picklist(options, opts?)`**
- `options`: non-empty readonly tuple of `string | number`; inferred as literals without `as const` (TypeScript `const` type parameter).
- Lookup is `Set.has` (SameValueZero): `1` and `"1"` are different; `NaN` cannot be listed meaningfully.
- `undefined`/`null` → `required` (message `requiredMessage ?? 'Required'`), anything else not listed → `invalid_enum` with `params.options` (a copy of the list).
- Metadata `{ type: 'union', variants: [{ type: 'literal', value }, ...] }`; proto encodes the variant index and zero payload bytes.

**`discriminatedUnion(key, variants, options?)`**
- Definition-time checks (throw `Error`): every variant has `.shape[key]` whose metadata is `literal` or a union of only literals (i.e. `literal()` / `picklist()`); no tag value is used twice.
- Runtime: `null`/`undefined` → `required`; non-object or array → `invalid_type`; the tag is read with the object rule (ignored only if inherited from `Object.prototype`). Missing tag → `VetaError('Property "<key>": Required', { path: [key], code: 'required' })`. Unknown tag → `code: 'invalid_discriminator'`, `params: { key, options }`, message `Property "<key>": Expected one of: ...`.
- The chosen variant receives `(val, ctx, collector)`, so its own errors, paths and `unknownKeys` behave as if it were called directly. With `objectAsync` variants the result is a Promise.
- Metadata: union of the variants' metadata, only if every variant has some.

**`record(keyValidator, valueValidator, options?)`**
- Walks `Object.keys(val)` (own enumerable, insertion order). For each key: key `__proto__` → `invalid_key`; `keyValidator(key, ctx)`; the **validator's output** becomes the result key (so a trimming key validator renames keys); an output of `__proto__` is rejected too; then `valueValidator(val[key], ctx, collector)`.
- Throw mode prefixes: `Key "<k>": ` for key failures, `Property "<k>": ` for value failures; both put `k` (the input key) in `path`.
- Collect mode: a key failure is recorded at `[..., k]` with the key validator's code (`custom` is mapped to `invalid_key`), and that key's value is not validated.
- Metadata `{ type: 'record', key, value }` when both the key and the value validator have metadata; none otherwise (all or nothing). `@coderbuzz/proto` encodes it as `varint(count)` + key/value pairs. In veta 0.5.0 and earlier there was no record variant, so an object containing a `record` could not be proto-encoded. No async variant: an async value validator would leave Promises in the result.

**`withDefault(validator, fallback)`**
- Only `undefined` triggers the fallback; `null` goes to the validator. A function fallback is called on every use (fresh objects); a non-function fallback is returned by reference. The fallback is **not** validated.
- Inside `object()`, a defaulted field is always present in the output even when the key was absent (the "absent stays absent" rule applies only when the output is `undefined`).
- Output type excludes `undefined`; metadata is the inner validator's, with one `optional` layer unwrapped.

**`lazy(getter)`**
- `getter` is called once, on the first validation, and cached. Forwards `ctx` and the collector. No metadata.

**`refine(validator, predicate, options)` / `check(validator, rule)`**
- Order: run `validator`; if it threw, propagate; under `safeParse`, if it recorded any issue, skip the rule; otherwise run the rule with `(value, ctx)` (`refine`) or `(value, report, ctx)` (`check`).
- `options` for `refine`: a message string, or `RefineIssue = { message, path?, code?, params? }`. `code` defaults to `'custom'`; `path` is relative to the refined value.
- Throw mode with several reported issues: the **first** becomes the error (`message` prefixed from its path, `path`, `code`, `params`, `reason`) and all of them are in `err.issues` (relative paths). With one issue, `err.issues` is empty.
- Collect mode: every reported issue is pushed at `collector.path + issue.path`.
- A non-`VetaError` thrown by the predicate/rule propagates like any other bug.
- `refineAsync`/`checkAsync` accept a sync or async inner validator and an async rule; they return a Promise even when everything is sync.
- Keep the rule sync-only in `refine`/`check`: a Promise-returning predicate in `refine` is truthy and always passes.

**`.partial(...keys)` / `.pick(...keys)` / `.omit(...keys)` / `.extend(shape)`**
- All build a **new** validator via the same factory (`object` or `objectAsync`) with the same `ObjectOptions`, so `unknownKeys` and messages carry over; `pick` with a key the shape lacks throws `Error` at definition. `omit` of a missing key is ignored.
- `partial()` with no keys wraps every field in `optional()`; with keys, only those. `extend` spreads the new shape over the old one (`{ ...shape, ...extra }`), so same-named keys are replaced and new keys are appended in order; shorthand is normalized.
- `.shape` is the normalized shape: shorthand entries appear as the `object()`/`array()`/`tuple()` validators they were turned into.

**`arrayAsync({ concurrency })`**
- Must be a positive integer or `Infinity`, else `Error` at definition. Without it, behaviour is unchanged (all items at once, sync results inline).
- Throw mode with `concurrency < length`: `concurrency` workers pull indices in order; the first failure sets a flag so no new item starts, and the call rejects with that item's error (`Item at index i: ...`). Items already running finish in the background; their results are discarded.
- Collect mode: the same worker pool; every item is settled into its own collector; issues are merged in **index order**, independent of completion order. Workers stop pulling new items once `maxIssues` is exhausted or a non-`VetaError` occurs.

**`safeParse(..., { maxIssues })`**
- `maxIssues` must be ≥ 1 (else `Error`). Every recorded issue decrements a budget shared by all child collectors; when it reaches 0 an internal sentinel (not a `VetaError`) unwinds straight to `safeParse`, which returns `{ ok: false, issues: issues.slice(0, maxIssues), truncated: true }`. Async children running concurrently may overshoot before they notice; the slice trims that.
- `truncated: true` also when exactly `maxIssues` issues existed; it means "stopped at the limit", not "there were more".

**`flattenIssues(issues)`**
- `formErrors`: messages of issues with an empty path, in order. `fieldErrors`: `path.join('.')` → messages, in first-seen key order. Built with `Object.fromEntries`, so a `__proto__` path is an own key. Nested `issue.issues` are not flattened.

**`VetaError` construction details**
- Fields are `declare`d and assigned in the constructor (no class-field `[[Define]]`), `name` lives on the prototype. This keeps a failed validation's dominant cost, error construction, at ≈480 ns in Bun (was ≈630 ns).
- Wrapping one level up (`Property "k": ` / `Item at index i: `) creates a new `VetaError` carrying the child's `code`, `params`, `issues` and `reason`, with `[segment, ...child.path]`. The child error object is never mutated, so errors a caller caches (e.g. rejected promises in a DataLoader) are safe to re-throw.

Behaviour changes in 0.5.0 an agent must know:

- Non-`VetaError` errors propagate (no wrapping); `safeParse` re-throws them.
- Absent keys are absent in object output (no `key: undefined`).
- `coerce(string/bigint/date())` are strict about input types (see Coercion Rules).
- `object()` metadata is all or nothing; `proto()` refuses undescribed fields.
- `VetaIssue` has a required `code`; `SafeParseResult` failure has `truncated`.

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
const event = discriminatedUnion("type", [
  object({ type: literal("click"), x: number(), y: number() }),
  object({ type: literal("keyup"), key: string() }),
  object({ type: literal("scroll"), delta: number() }),
]);
```

Prefer this over `union()` for tagged variants: one `Map` lookup, the chosen
variant's error at the right path, and full collection under `safeParse`.

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
    if (await db.usernameExists(name)) throw new VetaError("Username taken", { code: "taken" });
    return name;
  },
  email: async (val) => {
    const email = string({ pattern: /@/ })(val).toLowerCase();
    if (await db.emailExists(email)) throw new VetaError("Email taken", { code: "taken" });
    return email;
  },
  password: string({ min: 8 }),
});
```

### Enum

```ts
const Role = picklist(["admin", "editor", "viewer"], { message: "Invalid role" });
```

### Create vs PATCH schema

```ts
const invoiceCreate = object({ ref: string({ trim: true, min: 1 }), amount: decimal({ scale: 2 }), memo: optional(string()) }, { unknownKeys: "error" });
const invoicePatch = invoiceCreate.partial(); // same fields, all optional, unknownKeys carried over
// Absent keys stay absent in the output, so Object.keys(patch) is exactly what the client sent.
```

### Cross-field rule

```ts
const period = refine(object({ start: isoDate(), end: isoDate() }), (p) => p.end >= p.start,
  { message: "End date is before start date", path: ["end"] });
```

### Deep Nested with Shorthand

```ts
const adResponse = object({
  id: string(),
  ad: nullable(object({ // nullable() needs a validator; shorthand works only inside a shape
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
  })),
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
| `.safeParse()` | `safeParse(schema, val)` |
| `z.infer<typeof S>` | `ReturnType<typeof schema>`, or `InferObject<typeof shape>` |

**Key behavioral differences:**
1. Veta uses **options objects** (`{ min: 3 }`) instead of **chainable methods** (`.min(3)`), by design for tree-shaking and TypeScript performance
2. Veta validators are **called as functions** (`schema(val)`) not `.parse(val)`
3. Veta **strips unknown keys** by default (like Zod's `.strip()`). Use `object(shape, { unknownKeys: 'passthrough' })` or `'error'` for Zod's `.passthrough()` / `.strict()`
4. Veta **throws `VetaError` on invalid input**; `safeParse(schema, val)` returns `{ ok, value | issues }` with every failure instead
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
  role: picklist(["admin", "editor", "viewer"]),
  birthDate: nullable(coerce(date())),
  address: optional(object(addressShape)), // optional() needs a validator, not a shape
  tags: optional(array(string())),
  scores: [coerce(number())],            // shorthand, always required
});

type User = ReturnType<typeof userSchema>; // InferObject takes a shape, not a validator

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

1. **`optional()` does NOT pass `null`**: use `nullable()` or `nullish()` for
   that.
2. **`nullable()` does NOT pass `undefined`**: use `nullish()` or `optional()`.
3. **`union()` order matters**: `union([coerce(string()), coerce(number())])`
   will always return a string because `coerce(string())` accepts everything.
4. **`coerce(number())` rejects empty strings**: `""` → "Invalid number".
5. **`coerce(bigint())` rejects floats**: `1.5` → "Invalid bigint".
6. **Object validators strip extra keys** by default: only declared shape keys are
   returned, unless `unknownKeys: 'error' | 'passthrough'` is set (same for
   `objectAsync` and `.map()`). `'passthrough'` never copies `__proto__`.
   **Absent keys stay absent** in the output, even for `optional()` fields; a
   value inherited from `Object.prototype` is never read as input.
7. **`pipe()` metadata = last validator's metadata**: a custom function as the
   last step means no metadata.
8. **Shorthand tuple requires `as const`** for accurate TypeScript inference:
   `[string(), number()] as const`.
9. **`objectAsync()` runs async validators concurrently**: sync validators are
   resolved immediately, async validators run via `Promise.all`.
10. **`unionAsync()` is sequential**: it awaits each validator in order, unlike
    object/array which parallelize.
11. **`Buffer` passes `uint8array()`**: `Buffer extends Uint8Array`, so Node.js
    Buffer instances are accepted.
12. **Custom function validators have no METADATA** and no COERCE symbol:
    `coerce()` throws on them at construction.
13. **`.map()` is evaluated at call time on the whole object**: the mapping
    function receives the full input object, not the individual property value.
14. **Shorthand is only read inside a shape**: `optional({ a: string() })`,
    `nullable([string()])` and similar pass a non-function to the wrapper and
    throw `TypeError: validator is not a function` on the first call. Wrap with
    `object()` / `array()` first.
15. **Throw `VetaError`, not `Error`, from custom validators.** A plain `Error`
    is treated as a bug/outage and propagates out of `safeParse` and every
    compound (it is no longer wrapped into a `VetaError`).
16. **`union()` does not catch non-`VetaError`s**: a crashing variant fails the
    union instead of letting the next variant match.
17. **Use `isoDate()` for calendar dates**: a `Date` from `"2024-01-15"` is UTC
    midnight and reads as the 14th west of Greenwich.

---

## Internal Behavior

### Validation Pipeline

Every validator follows a consistent lifecycle:

```
input → type check (strict/coerced) → constraint checks → return value
             ↓ invalid
          throw VetaError(message, path)
```

1. **Type check**: if value is `undefined`/`null`, throw `"Required"` (or `requiredMessage`). In coerce mode, attempt type conversion first.
2. **Constraint checks**: validate `min`, `max`, `pattern` etc. in deterministic order. First failure wins.
3. **Return**: validated (and possibly coerced/transformed) value.

### Shorthand Normalization

Happens once at schema construction time. The `shape` object is walked recursively:

```
shape entry → value type detection:
  ├─ Array<Validator> with 1 element     → array(elementValidator)
  ├─ Array<Validator> with >1 elements   → tuple(validators)
  ├─ Plain object (no call signature)    → object(shape)
  └─ Function                            → keep as-is (custom validator)
```

This means shorthand overhead is **zero at call time**: the normalized schema is identical to the fully-qualified version.

### Object Validation Pipeline

```
object({ a: validatorA, b: validatorB })(input, ctx)
  ├─ Check: is input an object? → else throw "Invalid object"
  ├─ For each declared key:
  │   └─ validator(input[key], ctx) → store result
  └─ Return new object with only validated keys (extra keys stripped,
     unless unknownKeys is 'error' or 'passthrough')
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
| `arrayAsync` | All element validators run **concurrently** via `Promise.all`, or at most `concurrency` at a time |
| `tupleAsync` | All position validators run **concurrently** via `Promise.all` |
| `unionAsync` | Validators tried **sequentially** (each awaited before next) |
| `pipeAsync` | Validators run **sequentially** (each output feeds next input) |

Concurrent validators in `objectAsync`/`arrayAsync`/`tupleAsync` execute in parallel, a slow field/element does not block others.

### Context (ctx) Propagation

`ctx` is passed as the second argument to every validator in the tree:

```ts
schema(input, ctx)
  → object({ a: vA, b: object({ c: vC }) })(input, ctx)
    → vA(input.a, ctx)
    → object({ c: vC })(input.b, ctx)
      → vC(input.b.c, ctx)
```

All composition helpers (`optional`, `nullable`, `nullish`, `withDefault`, `lazy`, `withMeta`, `array`, `tuple`, `record`, `union`, `discriminatedUnion`, `pipe`, `refine`, `check`, and the async variants) forward `ctx`. The propagation is synchronous and zero-overhead: `ctx` is a direct argument, never stored or wrapped.

### METADATA Propagation Rules

| Wrapper | METADATA behavior |
|---|---|
| `coerce(validator)` | Preserves inner validator's metadata |
| `pipe(validators)` | Uses **last** validator's metadata |
| `optional(validator)` | `{ type: "optional", inner: <metadata> }` |
| `nullable(validator)` | `{ type: "nullable", inner: <metadata> }` |
| `nullish(validator)` | `{ type: "nullish", inner: <metadata> }` |
| `array` / `optional` / `nullable` / `nullish` | None if the inner validator has none |
| `tuple` / `union` / `discriminatedUnion` | None unless every child has metadata |
| `object(shape)` | None unless every field has metadata (all or nothing) |
| `object().map()` | Same as the object |
| Async variants | Same as their sync counterparts |
| `refine` / `check` / `withDefault` | The wrapped validator's (`withDefault` unwraps `optional`) |
| `withContext()` | Only with `{ meta }` |
| `withMeta(v, meta)` | `meta` |
| `decimal()` / `isoDate()` | `{ type: "string" }` |
| `picklist()` | Union of literals |
| Custom function, `lazy()` | No metadata attached |

---

## TypeScript Types Quick Reference

```ts
// Infer output type from a shape object
type T = InferObject<{ id: ReturnType<typeof number>; name: ReturnType<typeof string> }>;

// Infer output type from a validator function
type T = ReturnType<typeof myObjectSchema>;

// Infer async output
type T = Awaited<ReturnType<typeof myAsyncSchema>>;

// ValidationRule, used in options
type ValidationRule<T> = T | { value: T; message: string };

// TypeMeta, attached to validators under METADATA symbol
type TypeMeta = { type: "string" } | { type: "number" } | /* ... */;

// ObjectValidator: .shape, .map() and composition methods (AsyncObjectValidator mirrors it)
interface ObjectValidator<T> {
  (val: any, ctx?: any): T;
  readonly shape: { readonly [K in keyof T]-?: (val: any, ctx?: any) => T[K] };
  map(mapping: Partial<Record<keyof T, string | ((data: any) => any)>>): (val: any, ctx?: any) => T;
  partial(...keys?): ObjectValidator<...>;   // all, or the named keys, optional
  pick(...keys): ObjectValidator<Pick<T, K>>;
  omit(...keys): ObjectValidator<Omit<T, K>>;
  extend(shape): ObjectValidator<T & InferObject<E>>;  // replaces same-named keys
}
```
