import { test, expect } from "bun:test";
import { string, number, boolean, object, array, optional, InferObject } from "@coderbuzz/veta";

test("string validates", () => {
  const s = string();
  expect(s("hello")).toBe("hello");
  expect(() => s(undefined)).toThrow();
});

test("number validates", () => {
  const n = number();
  expect(n(42)).toBe(42);
  expect(() => n("x")).toThrow();
});

test("object validates", () => {
  const schema = object({ name: string(), age: number() });
  expect(schema({ name: "Alice", age: 30 })).toEqual({ name: "Alice", age: 30 });
});