<!-- docs: sync from coderbuzz/codex@a7c7bb5 -->

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
| Bundle size | ~35 KB min+gzip | ~20 KB | ~50 KB+ | **~9.5 KB min+gzip** (whole library), zero deps |

Veta matches **Zod's type inference quality** at ~9.5 KB min+gzip (vs. Zod's ~35 KB), and adds features Zod doesn't have: context forwarding, async mirror API, and schema metadata for binary serialization (used by `@coderbuzz/proto`).

---

## Highlights

- **Object shorthand syntax**: write `{ tags: [string()] }` instead of `{ tags: array(string()) }`
- **`.map()` on objects**: remap keys, extract deep paths, transform before validation
- **Built-in coercion**: `coerce(number())` accepts `"42"` → `42` from any source (form data, env vars, query params)
- **Sync + Async APIs**: `objectAsync` / `arrayAsync` / `tupleAsync` / `unionAsync` / `pipeAsync` with the same mental model
- **Context forwarding**: pass request-scoped data (SSP identifiers, auth, tenant IDs) through every validator
- **Schema metadata**: `METADATA` symbol for encoding layers like `@coderbuzz/proto`
- **Custom error messages**: per-validator or per-rule via `ValidationRule<T>`
- **Every error at once**: `safeParse` collects all issues, each with a `path`, a stable `code` and `params` for translation; `flattenIssues` groups them per form field
- **ERP-grade primitives**: exact `decimal()` for money, `isoDate()` for calendar dates, `picklist()`, `discriminatedUnion()`, `record()`, cross-field `refine()`/`check()`, and `.partial()`/`.pick()`/`.omit()`/`.extend()` for create vs. PATCH schemas
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
| `length`          | `ValidationRule<number>` | Exact string length                         |
| `pattern`         | `ValidationRule<RegExp>` | Regex pattern to test against               |
| `trim`            | `boolean`                | Trim whitespace before the checks, and return the trimmed string |
| `message`         | `string`                 | Fallback message for all validation errors  |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null` |

Strict by default. Only accepts `string` values. `coerce(string())` also accepts
a finite `number`, a `bigint` or a `boolean`, as their text. Objects, arrays,
dates, functions and symbols are rejected: `String({})` is `"[object Object]"`,
which satisfies a `min` check and used to be stored as such.

Use `trim: true` for anything a person types. Without it `"   "` satisfies
`min: 1`, and a name, a reference or a memo made of spaces is not one.

Lengths are counted in UTF-16 code units, as `.length` does: an emoji counts
as 2.

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
| `integer`         | `ValidationRule<boolean>`| Require a safe integer (quantities, counts, IDs) |
| `message`         | `string`                 | Fallback message for all validation errors  |
| `requiredMessage` | `string`                 | Message when value is `undefined` or `null` |

`integer: true` rejects fractions and integers beyond 2^53-1, where a float64
can no longer tell neighbouring integers apart (`9007199254740993` would be
stored as `...992`).

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

Strict mode only accepts `Date` instances. `coerce(date())` also accepts epoch
milliseconds and strings that **start with a calendar date** (`YYYY-MM-DD`,
then the end or a `T`/space time part). That covers ISO 8601 and every
timestamp format the SQL drivers return (`"2024-01-15 10:00:00+07"`).

It used to be `new Date(val)`, which accepts nearly anything: `true` was 1 ms
after the epoch, `"1"` was 1 January 2001, `[2024]` was New Year 2024, and
`"2024-02-31"` rolled over to 2 March. A posting date typed as 31 February
landed in March, a different accounting period, without an error. A date that
does not exist is now rejected.

A `Date` is an instant. For a day (a posting date, a due date) use
[`isoDate()`](#isodateoptions): `"2024-01-15"` parses as UTC midnight, which is
still the 14th anywhere west of Greenwich.

**Options:**

| Option            | Type                   | Description                                 |
| ----------------- | ---------------------- | ------------------------------------------- |
| `min`             | `ValidationRule<Date>` | Earliest allowed date (inclusive)           |
| `max`             | `ValidationRule<Date>` | Latest allowed date (inclusive)             |
| `message`         | `string`               | Fallback message                            |
| `requiredMessage` | `string`               | Message when value is `undefined` or `null` |

---

### `isoDate(options?)`

A calendar date written as `"YYYY-MM-DD"`, returned as that **string**: the
date-only counterpart of `decimal()`.

```ts
const postingDate = isoDate({ min: "2024-01-01" });
postingDate("2024-02-29"); // "2024-02-29"
postingDate("2023-02-29"); // throws, not a calendar date
postingDate("2024-2-9");   // throws, must be zero-padded
postingDate("2023-12-31"); // throws "Date too early (min: 2024-01-01)"
coerce(isoDate())(" 2024-02-29 "); // "2024-02-29", coerce trims
```

A posting date, a due date or a birth date is a day, not an instant. Held as a
`Date` it is an instant at some timezone's midnight, and it moves: an invoice
dated `2024-01-01` in Jakarta is `2023-12-31T17:00:00Z`, which lands in the
previous fiscal year the moment any code reads the UTC date. A string cannot
move, and it is what `DATE` columns mean. Because the format is fixed-width,
string order is date order, so `min`/`max` (and your own comparisons) are
plain string comparisons.

**Options:** `min`, `max` (as `"YYYY-MM-DD"`), `message`, `requiredMessage`

---

### `bigint(options?)`

```ts
const v = bigint({ min: 0n, max: 1000n });
v(500n); // 500n
v(1001n); // throws "BigInt too large (max: 1000)"
v("123"); // throws "Invalid bigint: expected bigint, got string"
```

`coerce(bigint())` accepts an integer string (optional sign, surrounding
whitespace trimmed) or a safe-integer `number`. Everything else is rejected.
It used to be `BigInt(val)`, which has the quirks `Number(val)` had: `""` and
`"  "` were `0n`, `[]` was `0n`, `true` was `1n` and `"0x10"` was `16n`, so an
empty ID field in a form validated as ID 0.

**`coerce()` only wraps the primitives that define a coerced form**: `string`,
`number`, `boolean`, `date`, `bigint`, `decimal`, `isoDate`. Anything else throws where you
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
| `string`  | a string, or a finite number, bigint or boolean as text; objects, arrays, dates throw |
| `number`  | a `number`, or a plain decimal string (trimmed); `""`, hex, `Infinity`, booleans, arrays throw |
| `boolean` | `true`/`"true"`/`1`/`"1"` → `true`; `false`/`"false"`/`0`/`"0"` → `false` |
| `date`    | a `Date`, epoch ms, or a string starting with an existing `YYYY-MM-DD`; anything else throws |
| `isoDate` | trims surrounding whitespace                                             |
| `decimal` | a decimal string, a `bigint`, or a safe integer `number`                 |
| `bigint`  | an integer string (trimmed) or a safe integer; `""`, hex, floats, booleans, arrays throw |

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

**A key that is absent from the input is absent from the output**, even when
its validator is `optional()`. It used to come out as `key: undefined`, an own
property, and on a PATCH that erased the difference between "not sent" and
"sent as empty": an update builder that walks `Object.keys(body)` wrote NULL
over every column the user did not touch. A key sent as `undefined` is kept.

**A value inherited from `Object.prototype` is never read as input.** On a
plain object, `val.isAdmin` reads `Object.prototype.isAdmin` when the key is
absent, so once anything in the process has polluted the prototype every schema
with an optional `isAdmin` would validate it as `true`. Values inherited from
anywhere else, such as a getter on a class you validate, are read as before.

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

The validator `.map()` returns keeps the object's `METADATA` and honours
`unknownKeys`, checked against the input keys it actually reads: `{ age: "userAge" }`
makes `userAge` known and `age` unknown. A function mapping can read anything, so
`.map()` refuses one when `unknownKeys` is not `'strip'`.

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

### `.shape`, `.partial()`, `.pick()`, `.omit()`, `.extend()`

Every `object()` and `objectAsync()` validator exposes its field validators as
`.shape` and can derive new schemas from itself, so a create schema and its
PATCH schema are not written twice. Options (`unknownKeys`, messages) carry
over.

```ts
const invoice = object(
  { ref: string(), amount: decimal({ scale: 2 }), memo: optional(string()) },
  { unknownKeys: "error" },
);

const invoicePatch = invoice.partial();          // every field optional
const amountOnly  = invoice.partial("amount");   // just these optional
const summary     = invoice.pick("ref", "amount");
const noMemo      = invoice.omit("memo");
const withCcy     = invoice.extend({ currency: string({ length: 3 }) }); // add or replace

invoice.shape.amount("10"); // "10.00": the field validator itself
```

The derived types are inferred: `ReturnType<typeof invoicePatch>` is
`{ ref?: string; amount?: string; memo?: string }`.

---

### `array(validator, options?)`

```ts
const v = array(coerce(number()), { min: 1, max: 10 });
v(["1", "2", "3"]); // [1, 2, 3]
v([1, "bad"]); // throws "Item at index 1: Invalid number: ..."
```

**Options:** `min`, `max`, `message`, `requiredMessage`

Under `safeParse`, a `min` failure is reported and the items present are still
checked (so the user hears about both at once). A `max` failure stops there:
validating every item of an oversized array anyway would turn a bound meant to
limit the work into a list of issues as long as the payload.

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

For a fixed set of values use [`picklist()`](#picklistoptions-opts), and for
object variants tagged by a field use
[`discriminatedUnion()`](#discriminatedunionkey-variants-options). Both are
faster than a union and give better errors.

A variant that throws something other than a `VetaError` (a bug, a failed
database lookup) is not a "no match": the error propagates at once instead of
the next variant being tried and possibly matching.

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

### `picklist(options, opts?)`

One of a fixed set of strings or numbers: a status, a document type, a
currency code.

```ts
const status = picklist(["draft", "posted", "void"]);
status("posted"); // "posted", typed "draft" | "posted" | "void"
status("closed"); // throws 'Expected one of: "draft", "posted", "void"'
```

`union([literal("draft"), literal("posted"), ...])` does the same job by trying
each literal in turn and building an error for every miss: about 4.4 µs to
match the fourth of four options, against 23 ns for `picklist`'s `Set` lookup.
Its error also lists `Variant 0: ... Variant 3: ...`. `picklist` carries union-
of-literal metadata, so `@coderbuzz/proto` encodes it.

**Options:** `message`, `requiredMessage`

---

### `discriminatedUnion(key, variants, options?)`

A union of object variants told apart by one field. The field is read first and
exactly one variant runs:

```ts
const payment = discriminatedUnion("method", [
  object({ method: literal("card"), cardNumber: string({ length: 16 }) }),
  object({ method: literal("transfer"), bankCode: string(), account: string() }),
  object({ method: picklist(["cash", "cheque"]), note: optional(string()) }),
]);

payment({ method: "card", cardNumber: "1" });
// throws 'Property "cardNumber": String must be exactly 16 characters'
payment({ method: "crypto" });
// throws 'Property "method": Expected one of: "card", "transfer", "cash", "cheque"'
```

Compared with `union()`: the error is the chosen variant's own, at the right
path; `safeParse` collects every issue inside that variant; and it costs one
`Map` lookup instead of one failed validation per variant. Each variant must be
an `object()`/`objectAsync()` whose `key` field is a `literal()` or a
`picklist()`; that is checked when the union is defined, as is a tag used by two
variants.

**Options:** `message` (input is not an object), `requiredMessage`

---

### `record(keyValidator, valueValidator, options?)`

An object used as a dictionary: translations by locale, prices by currency.

```ts
const prices = record(picklist(["IDR", "USD"]), decimal({ scale: 2 }));
prices({ IDR: "15000", USD: "1" }); // { IDR: "15000.00", USD: "1.00" }
prices({ EUR: "1" });               // throws 'Key "EUR": Expected one of: "IDR", "USD"'
```

With a finite key type the result is typed `Partial<Record<K, V>>`: `record`
checks the keys that are present, it does not require every possible one. A
`__proto__` key is rejected, not copied. Collects under `safeParse`.

**Options:** `message` (input is not an object), `requiredMessage`

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

### `withDefault(validator, fallback)`

Uses `fallback` when the value is `undefined`, and validates it otherwise.
Pass a function for a fresh value per call: a shared `[]` would otherwise be
the same array in every result. The fallback is returned as is; `null` is a
value and is validated like any other.

```ts
const line = object({
  qty: withDefault(number({ integer: true, min: 1 }), 1),
  tags: withDefault(array(string()), () => []),
});
line({}); // { qty: 1, tags: [] }
```

---

### `lazy(getter)`

Defers building a validator until first use, for recursive schemas such as a
chart of accounts or a bill of materials. TypeScript cannot infer a recursive
type, so declare it:

```ts
type Account = { code: string; children: Account[] };
const account: (val: any) => Account = object({
  code: string(),
  children: array(lazy(() => account)),
});
```

A lazy validator has no metadata, since a recursive type has no finite
`TypeMeta`.

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

Under `safeParse` every stage is given the collector, so `pipe([object({...}), ...])`
still reports every bad field of the object. A stage that recorded issues ends
the pipe, because the next stage would run on a value that has already failed.
For rules about the whole value, `refine()`/`check()` below are usually a better
fit: they can point an issue at a field.

---

### `refine(validator, predicate, options)` and `check(validator, rule)`

Rules about the whole value: cross-field checks. They run only when `validator`
accepted the value, so they can rely on its type. `path` points the issue at a
field, which is what puts it next to the right input on a form.

```ts
const period = refine(
  object({ start: isoDate(), end: isoDate() }),
  (p) => p.end >= p.start,
  { message: "End date is before start date", path: ["end"] },
);

period({ start: "2024-02-01", end: "2024-01-31" });
// throws 'Property "end": End date is before start date', err.path = ["end"]
```

`check` reports as many issues as it finds. Under `safeParse` they are all
collected; a direct call throws the first, with the rest in `err.issues`.

```ts
const journal = check(
  object({ lines: array(object({ debit: decimal({ scale: 2 }), credit: decimal({ scale: 2 }) })) }),
  (j, report) => {
    j.lines.forEach((l, i) => {
      if (l.debit !== "0.00" && l.credit !== "0.00") {
        report({ message: "A line is either a debit or a credit", path: ["lines", i], code: "both_sides" });
      }
    });
  },
);
```

An issue is `{ message, path?, code?, params? }`; `options` may also be just the
message string. Both keep the wrapped validator's metadata. `refineAsync` and
`checkAsync` take a predicate or rule that awaits, such as a uniqueness lookup.

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
  if (exists) throw new VetaError("Username already taken", { code: "taken" });
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

**Options:** the same as `object()`, including `unknownKeys`. With
`unknownKeys: 'error'` the keys are checked before any async field runs, so a
request that will be rejected does not first spend a database round trip per
field. `objectAsync` also has `.map()`, `.shape` and the composition methods.

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

Every item starts at once by default. Bound it with `concurrency`:

```ts
arrayAsync(checkAccountExists, { concurrency: 10 });
```

A 5 000-line import whose lines each check an account in the database is
otherwise 5 000 simultaneous queries against a pool of perhaps twenty
connections: the import times out, and so does every other request waiting
for a connection. In throwing mode, the first failure stops new work from
starting.

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
`tuple`, `record`, `union`, `discriminatedUnion`, `pipe`, `refine`, `check`,
`optional`, `nullable`, `nullish`, `withDefault`, `lazy`, `withMeta`, and the
async variants. `refine`/`check` rules receive it as their last argument.

The built-in **leaf** validators (`string`, `number`, `boolean`, `date`,
`bigint`, `decimal`, `isoDate`, `uint8array`, `literal`, `picklist`) take one argument and ignore any
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
| `ObjectValidator<T>` / `AsyncObjectValidator<T>` | What `object()` / `objectAsync()` return, with `.shape` and the composition methods |
| `VetaIssue`, `VetaIssueCode`, `SafeParseResult<T>`, `FlattenedIssues` | See [Error Reference](#error-reference) |
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

`InferObject` and `InferAsyncObject` decide optionality by the same rule: a
field is optional exactly when its output type includes `undefined`. They used
to differ: `unknown()` was required in `object()` and optional in
`objectAsync()`, and nested shorthand objects in `objectAsync()` did not get
optional keys at all.

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
  | { type: "record"; key: TypeMeta; value: TypeMeta }
  | { type: "array"; items: TypeMeta }
  | { type: "tuple"; items: TypeMeta[] }
  | { type: "optional"; inner: TypeMeta }
  | { type: "nullable"; inner: TypeMeta }
  | { type: "nullish"; inner: TypeMeta }
  | { type: "union"; variants: TypeMeta[] };
```

Notes:
- `coerce(validator)` preserves the inner validator's metadata.
- `pipe(validators)` uses the last validator's metadata; `refine`, `check` and
  `withDefault` keep the wrapped validator's.
- `decimal()` and `isoDate()` carry `{ type: "string" }`; `picklist()` a union of literals;
  `record(k, v)` carries `{ type: "record", key, value }` when both `k` and `v` have metadata.
- The async variants carry the same metadata as their sync counterparts.
- Custom function validators, `withContext()` and `lazy()` have none. Describe
  one with `withMeta(validator, meta)`, or `withContext(fn, { meta })`.
- **Metadata is all or nothing.** `object`, `array`, `tuple`, `union`,
  `discriminatedUnion`, `optional`, `nullable` and `nullish` get it only when
  every child has it. `object()` used to describe the fields that had metadata
  and silently leave out the rest, and `@coderbuzz/proto` then built a codec
  that dropped those fields: a round trip lost data without an error. Now
  `proto()` refuses the schema and says which helper to use.

```ts
const upper = (v: any) => String(v).toUpperCase();
object({ ref: string(), currency: upper });                               // no metadata
object({ ref: string(), currency: withMeta(upper, { type: "string" }) }); // fully described
```

`withMeta` is a promise about the output type that nothing checks: describing a
function that returns numbers as `{ type: "string" }` produces a codec that
corrupts them.

---

## Error Reference

All validators throw `VetaError` (exported from `@coderbuzz/veta`) when validation fails.
`VetaError` extends `Error`. Use `err instanceof VetaError` (or `isVetaError(err)`) to
distinguish validation failures from other runtime errors.

```ts
import { VetaError, string } from "@coderbuzz/veta";

try {
  object({ name: string({ min: 3 }) })(input);
} catch (err) {
  if (err instanceof VetaError) {
    err.message; // 'Property "name": String too short (min: 3)'
    err.reason;  // "String too short (min: 3)", without the location prefix
    err.path;    // ["name"]
    err.code;    // "too_small"
    err.params;  // { min: 3, type: "string" }
    err.toIssue(); // { path: ["name"], message: "String too short (min: 3)", code: "too_small", params: {...} }
  }
}
```

`path` tracks traversal through nested objects, arrays, and tuples:
`["users", 1, "email"]` for the 2nd user's email field.

### Only a `VetaError` is a validation failure

A validator reports bad input by throwing a `VetaError`. **Anything else it
throws propagates unchanged** through every compound validator and through
`safeParse`: a `TypeError` from a bug, a database timeout inside an async
uniqueness check. It reaches your error handler as the 500 it is.

It used to be wrapped. A database outage inside an async email check became
`VetaError: Property "email": connect ECONNREFUSED 10.0.0.5:5432`, a 400 that told
the client the database's internal address and told the operator nothing,
because 4xx responses are not logged as failures. `union()` was worse: a variant
that crashed was treated as "no match" and the next variant was tried.

So write custom validators with `VetaError`, not `Error`:

```ts
const username = async (val: unknown) => {
  const name = string({ min: 3 })(val);
  if (await db.users.exists({ name })) {
    throw new VetaError("Username already taken", { code: "taken" });
  }
  return name;
};
```

`new VetaError(message, { path?, code?, params?, issues? })`; `code` defaults to
`"custom"`. The older positional form `new VetaError(message, path, issues)` still
works. `instanceof VetaError` recognises errors from any copy of veta in the
process (a veta bundled twice has two classes), through a shared brand.
`JSON.stringify(err)` includes `message`, `code`, `path`, `params` and `issues`.

### Codes and params

Every failure carries a machine-readable `code`, and the values a translated
message needs in `params`. Messages are English prose and may change between
versions; codes do not. Show errors in another language, or decide what to do
based on why a field failed, from `code` and `params`, never from `message`.

| Code                    | Produced by                                                   | `params`                          |
| ----------------------- | ------------------------------------------------------------- | --------------------------------- |
| `required`              | any validator, for `undefined`/`null`                          |                                   |
| `invalid_type`          | wrong type (and coerce inputs it cannot take)                  | `{ expected, received }`          |
| `invalid_format`        | `pattern`; unparseable number/decimal/date/integer text        | `{ format, pattern? }`            |
| `invalid_date`          | a date that does not exist, an invalid `Date`                  |                                   |
| `too_small` / `too_big` | `min` / `max` on any type                                      | `{ min \| max, type }`            |
| `invalid_length`        | `string({ length })`, tuple length                             | `{ length, type }`                |
| `not_finite`            | `NaN`, `Infinity`                                              |                                   |
| `not_integer`           | `number({ integer })`; unsafe integer in `coerce(bigint())`    |                                   |
| `invalid_scale`         | `decimal({ scale })`                                           | `{ scale }`                       |
| `invalid_precision`     | `decimal({ precision })`                                       | `{ precision }`                   |
| `invalid_literal`       | `literal()`                                                    | `{ expected }`                    |
| `invalid_enum`          | `picklist()`                                                   | `{ options }`                     |
| `invalid_union`         | `union()` (see `issues`)                                       |                                   |
| `invalid_discriminator` | `discriminatedUnion()`                                         | `{ key, options }`                |
| `invalid_key`           | `record()` key                                                 |                                   |
| `unknown_key`           | `object({ unknownKeys: 'error' })`                             | `{ keys }` on the thrown error    |
| `context_required`      | `withContext()` without a context                              |                                   |
| `custom`                | your validators, unless you pass a code                        |                                   |

`type` in `too_small`/`too_big` is `string`, `number`, `array`, `date`,
`bigint`, `decimal` or `uint8array`, so "at least 3 characters" and "at least 3
items" can be told apart. `params` are always JSON-safe: dates are ISO strings
and bigints decimal strings, so an issue list can go straight into a response.

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
  //   { path: ["ref"],                 code: "too_small",     message: "String too short (min: 3)", params: {...} },
  //   { path: ["lines", 0, "account"], code: "invalid_type",  message: "Invalid string: expected string, got number", params: {...} },
  //   { path: ["lines", 0, "amount"],  code: "invalid_scale", message: "Too many fraction digits (max: 2)", params: {...} },
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

Collection reaches through `object`, `array`, `tuple`, `record`,
`discriminatedUnion`, `pipe`, `refine`/`check`, the async variants, and the
`optional`/`nullable`/`nullish`/`withDefault`/`lazy` wrappers. `union()` and
your own custom validators stay leaves: a union has no single child to
attribute a failure to (use `discriminatedUnion` when the variants are tagged),
and a custom validator does not know about the collector. Each contributes one
issue; a union's issue carries each variant's failure in `issues`.

Calling a validator directly is completely unaffected. It throws on the first
failure exactly as before.

**Group them for a form** with `flattenIssues`:

```ts
import { flattenIssues } from "@coderbuzz/veta";

if (!result.ok) {
  const { formErrors, fieldErrors } = flattenIssues(result.issues);
  // formErrors:  messages at the root (path [])
  // fieldErrors: { "ref": ["String too short (min: 3)"], "lines.0.amount": ["Too many fraction digits (max: 2)"] }
}
```

**Bound the work** with `maxIssues` on any endpoint that accepts a large
array. A 10 000-line import in which every line is wrong otherwise produces
tens of thousands of issues, a response body larger than the request, built
for whoever sent the payload:

```ts
const result = safeParse(importSchema, body, ctx, { maxIssues: 100 });
if (!result.ok && result.truncated) {
  // stopped at 100; there may be more
}
```

**Only validation failures become issues.** A non-`VetaError` a validator
throws is re-thrown by `safeParse`; see
[Only a `VetaError` is a validation failure](#only-a-vetaerror-is-a-validation-failure).

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
the result unvalidated. Under `safeParse`, `'error'` reports one `unknown_key`
issue per key, at that key's path.

`'passthrough'` never copies a `__proto__` key. `JSON.parse` turns
`{"__proto__": {"isAdmin": true}}` into an object with an own `__proto__`
property, and assigning that onto the result replaced the result's prototype:
`result.isAdmin` became `true` without `isAdmin` appearing in `Object.keys`.
`'error'` reports it as unknown like any other key.

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
  isoDate,
  type InferObject,
  nullable,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
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
  email: pipe([string({ trim: true }), (s: string) => s.toLowerCase()]),
  role: picklist(["admin", "editor", "viewer"]),
  birthDate: nullable(coerce(isoDate())),
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
| `z.discriminatedUnion(k, [...])` | `discriminatedUnion(k, [...])` |
| `z.enum([...])` | `picklist([...])` |
| `z.record(k, v)` | `record(k, v)` |
| `z.lazy(() => S)` | `lazy(() => S)` |
| `z.literal(v)` | `literal(v)` |
| `z.optional(z.string())` | `optional(string())` |
| `z.nullable(z.string())` | `nullable(string())` |
| `z.string().min(3)` | `string({ min: 3 })` |
| `z.string().max(100)` | `string({ max: 100 })` |
| `z.string().regex(/^a+$/)` | `string({ pattern: /^a+$/ })` |
| `z.string().length(3)` / `.trim()` | `string({ length: 3, trim: true })` |
| `z.number().int()` | `number({ integer: true })` |
| `z.string().date()` | `isoDate()` |
| `z.coerce.number()` | `coerce(number())` |
| `.transform(fn)` | `pipe([validate, fn])` |
| `.refine(fn, { path })` / `.superRefine(fn)` | `refine(v, fn, { message, path })` / `check(v, fn)` |
| `.default(x)` | `withDefault(v, x)` |
| `.partial()` / `.pick()` / `.omit()` / `.extend()` | the same methods on `object()` |
| `error.flatten()` | `flattenIssues(result.issues)` |
| `z.undefined()` | Used `optional()` |
| `.parse()` | Call as function: `schema(val)` |
| `.safeParse()` | `safeParse(schema, val)`, returning `{ ok, value }` or `{ ok: false, issues, truncated }` |
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
