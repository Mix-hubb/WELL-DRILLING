import { describe, expect, it } from "vitest";
import { sanitizeLiffId } from "./liffId";

describe("sanitizeLiffId", () => {
  it("strips extra path and extracts from a LINE URL", () => {
    expect(sanitizeLiffId("2011510067-abcdef/repair-form")).toBe("2011510067-abcdef");
    expect(sanitizeLiffId("https://liff.line.me/2011510067-abcdef")).toBe("2011510067-abcdef");
  });
});
