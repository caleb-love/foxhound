import { describe, it, expect } from "vitest";
import { renderTemplate } from "./template.js";

describe("renderTemplate", () => {
  it("substitutes string values", () => {
    expect(renderTemplate("hello {{name}}", { name: "world" })).toBe("hello world");
  });

  it("JSON-stringifies non-string values", () => {
    expect(renderTemplate("data: {{x}}", { x: { a: 1 } })).toBe('data: {"a":1}');
    expect(renderTemplate("n={{n}}", { n: 42 })).toBe("n=42");
    expect(renderTemplate("flag={{f}}", { f: true })).toBe("flag=true");
    expect(renderTemplate("arr={{a}}", { a: [1, 2] })).toBe("arr=[1,2]");
  });

  it("preserves placeholder when key is missing", () => {
    expect(renderTemplate("hi {{unknown}}", {})).toBe("hi {{unknown}}");
  });

  it("preserves placeholder when value is undefined", () => {
    expect(renderTemplate("v={{v}}", { v: undefined })).toBe("v={{v}}");
  });

  it("renders nulls as JSON null", () => {
    expect(renderTemplate("v={{v}}", { v: null })).toBe("v=null");
  });

  it("renders multiple placeholders independently", () => {
    expect(renderTemplate("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y");
  });

  it("ignores text that looks like but is not a placeholder", () => {
    expect(renderTemplate("{ {a}} {{a}", { a: "Z" })).toBe("{ {a}} {{a}");
  });
});
