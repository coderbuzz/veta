import { test, expect } from "bun:test";
import { string, number, boolean, object, array, optional, InferObject } from "@coderbuzz/veta";

test("string validates", () => {
  expect(string("hello")).toBe("hello");
  expect(() => string(undefined)).toThrow();
});

test("number validates", () => {
  expect(number(42)).toBe(42);
  expect(() => number("x")).toThrow();
});

test("object validates", () => {
  const schema = object({ name: string(), age: number() });
  expect(schema({ name: "Alice", age: 30 })).toEqual({ name: "Alice", age: 30 });
});