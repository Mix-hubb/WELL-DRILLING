import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { userFilter, userWhere } from "./userFilter";

function reqWith(orgId?: string | null): Request {
  return { user: { orgId } } as unknown as Request;
}

describe("userFilter", () => {
  it("returns empty sql/params when no org id", () => {
    const { sql, params } = userFilter(reqWith(undefined), "c");
    expect(sql).toBe("");
    expect(params).toEqual([]);
  });

  it("returns an AND clause when org id exists", () => {
    const { sql, params } = userFilter(reqWith("org-1"), "c");
    expect(sql).toBe(" AND c.org_id = $1");
    expect(params).toEqual(["org-1"]);
  });

  it("uses the given alias", () => {
    const { sql } = userFilter(reqWith("org-1"), "customers");
    expect(sql).toBe(" AND customers.org_id = $1");
  });

  it("defaults the alias to c", () => {
    const { sql } = userFilter(reqWith("org-1"));
    expect(sql).toBe(" AND c.org_id = $1");
  });
});

describe("userWhere", () => {
  it("returns WHERE 1=1 when no org id", () => {
    const { sql, params } = userWhere(reqWith(undefined), "c");
    expect(sql).toBe("WHERE 1=1");
    expect(params).toEqual([]);
  });

  it("returns a WHERE clause when org id exists", () => {
    const { sql, params } = userWhere(reqWith("org-1"), "c");
    expect(sql).toBe("WHERE c.org_id = $1");
    expect(params).toEqual(["org-1"]);
  });

  it("uses the given alias", () => {
    const { sql } = userWhere(reqWith("org-1"), "customers");
    expect(sql).toBe("WHERE customers.org_id = $1");
  });
});