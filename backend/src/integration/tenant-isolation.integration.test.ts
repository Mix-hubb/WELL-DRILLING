import { randomUUID } from "crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const orgIds = [randomUUID(), randomUUID()];
const customerIds: string[] = [];

describeIntegration("multi-tenant database isolation", () => {
  beforeAll(async () => {
    await pool!.query(
      "INSERT INTO organizations (org_id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)",
      [orgIds[0], "Integration Org A", `integration-a-${orgIds[0]}`, orgIds[1], "Integration Org B", `integration-b-${orgIds[1]}`]
    );
    for (const [index, orgId] of orgIds.entries()) {
      const result = await pool!.query(
        "INSERT INTO customers (customer_name, phone, org_id) VALUES ($1, $2, $3) RETURNING customer_id",
        [`Integration Customer ${index}`, `09999999${index}`, orgId]
      );
      customerIds.push(result.rows[0].customer_id);
    }
  });

  afterAll(async () => {
    await pool!.query("DELETE FROM customers WHERE customer_id = ANY($1::uuid[])", [customerIds]);
    await pool!.query("DELETE FROM organizations WHERE org_id = ANY($1::uuid[])", [orgIds]);
    await pool!.end();
  });

  it("cannot read another organization's customer with the tenant predicate", async () => {
    const result = await pool!.query(
      "SELECT customer_id FROM customers WHERE customer_id = $1 AND org_id = $2",
      [customerIds[1], orgIds[0]]
    );
    expect(result.rows).toHaveLength(0);
  });

  it("cannot update another organization's customer with the tenant predicate", async () => {
    const result = await pool!.query(
      "UPDATE customers SET customer_name = $1 WHERE customer_id = $2 AND org_id = $3 RETURNING customer_id",
      ["Should Not Update", customerIds[1], orgIds[0]]
    );
    expect(result.rows).toHaveLength(0);

    const unchanged = await pool!.query("SELECT customer_name FROM customers WHERE customer_id = $1", [customerIds[1]]);
    expect(unchanged.rows[0].customer_name).toBe("Integration Customer 1");
  });
});
