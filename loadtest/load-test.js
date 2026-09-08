import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

// ===== Custom Metrics =====
const errorRate = new Rate("errors");
const statsDuration = new Trend("stats_duration", true);

// ===== Config =====
const BASE_URL = "https://well-drilling-api.onrender.com";
const TEST_EMAIL = "phet@gmail.com";
const TEST_PASSWORD = "asdzxc123";

// ===== Staged Load Test =====
export const options = {
  stages: [
    { duration: "20s", target: 5 },
    { duration: "30s", target: 10 },
    { duration: "30s", target: 100 },
    { duration: "30s", target: 500 },
    { duration: "20s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    errors: ["rate<0.1"],
  },
};

// ===== Shared token (cached per VU) =====
let cachedToken = null;

function getToken() {
  if (cachedToken) return cachedToken;

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "auth_login" } }
  );

  if (res.status === 200) {
    try {
      cachedToken = JSON.parse(res.body).token;
      return cachedToken;
    } catch {}
  }

  console.error(`Login failed: ${res.status} ${res.body}`);
  return null;
}

// ===== Main Test =====
export default function () {
  const token = getToken();
  if (!token) {
    errorRate.add(1);
    return;
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // --- Test 1: Health check (public) ---
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: "health" },
  });
  check(healthRes, {
    "health: status 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // --- Test 2: Stats overview (heavy) ---
  const statsRes = http.get(`${BASE_URL}/api/stats/overview`, {
    headers: authHeaders,
    tags: { name: "stats_overview" },
  });
  check(statsRes, {
    "stats: status 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // --- Test 3: Jobs list ---
  const jobsRes = http.get(`${BASE_URL}/api/jobs`, {
    headers: authHeaders,
    tags: { name: "jobs_list" },
  });
  check(jobsRes, {
    "jobs: status 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // --- Test 4: Customers list ---
  const customersRes = http.get(`${BASE_URL}/api/customers`, {
    headers: authHeaders,
    tags: { name: "customers_list" },
  });
  check(customersRes, {
    "customers: status 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // --- Think time ---
  sleep(Math.random() * 2 + 1);
}

// ===== Summary Report =====
export function handleSummary(data) {
  const metrics = data.metrics;

  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      total_requests: metrics.http_reqs?.values?.count || 0,
      avg_response_time_ms: Math.round(metrics.http_req_duration?.values?.avg || 0),
      p95_response_time_ms: Math.round(metrics.http_req_duration?.values?.["p(95)"] || 0),
      p99_response_time_ms: Math.round(metrics.http_req_duration?.values?.["p(99)"] || 0),
      max_response_time_ms: Math.round(metrics.http_req_duration?.values?.max || 0),
      error_rate_percent: ((metrics.errors?.values?.rate || 0) * 100).toFixed(2),
      requests_per_second: (metrics.http_reqs?.values?.rate || 0).toFixed(2),
    },
    by_endpoint: {},
  };

  // Per-tag breakdown
  for (const [key, val] of Object.entries(metrics)) {
    if (key.startsWith("http_req_duration{") && val.values) {
      const tagMatch = key.match(/name:([^,}]+)/);
      const tag = tagMatch ? tagMatch[1] : key;
      results.by_endpoint[tag] = {
        avg_ms: Math.round(val.values.avg || 0),
        p95_ms: Math.round(val.values["p(95)"] || 0),
        p99_ms: Math.round(val.values["p(99)"] || 0),
        max_ms: Math.round(val.values.max || 0),
        count: val.values.count || 0,
      };
    }
  }

  // Print to console
  console.log("\n========================================");
  console.log("       LOAD TEST RESULTS SUMMARY");
  console.log("========================================");
  console.log(JSON.stringify(results, null, 2));
  console.log("========================================\n");

  return {
    "load-test-results.json": JSON.stringify(results, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
