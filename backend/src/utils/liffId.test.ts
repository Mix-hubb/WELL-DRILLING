import { describe, expect, it } from "vitest";
import { sanitizeLiffId } from "./liffId";

describe("sanitizeLiffId", () => {
  it("returns empty string for missing values", () => {
    expect(sanitizeLiffId(undefined)).toBe("");
    expect(sanitizeLiffId(null)).toBe("");
    expect(sanitizeLiffId("")).toBe("");
  });

  it("keeps a plain LIFF ID", () => {
    expect(sanitizeLiffId("2011510067-abcdef")).toBe("2011510067-abcdef");
  });

  it("strips extra path and query from a pasted ID", () => {
    expect(sanitizeLiffId("2011510067-abcdef/request-drill?x=1")).toBe("2011510067-abcdef");
  });

  it("extracts the ID from a liff.line.me URL", () => {
    expect(sanitizeLiffId("https://liff.line.me/2011510067-abcdef/request-drill")).toBe("2011510067-abcdef");
  });

  it("uses the first value when given an array", () => {
    expect(sanitizeLiffId(["2011510067-abcdef", "other"])).toBe("2011510067-abcdef");
  });
});
