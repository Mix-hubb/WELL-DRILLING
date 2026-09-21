import http from "k6/http";
import { check, sleep } from "k6";

// Defaults to the local dev stack; pass --env BASE_URL=... to override.
// Against a local server this is just a cheap pre-flight health check —
// its original purpose (waking a cold Render free-tier instance) doesn't
// apply to localhost.
const BASE_URL = __ENV.BASE_URL || "http://localhost:4001";

export const options = {
  vus: 1,
  duration: "30s",
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health: status 200": (r) => r.status === 200 });
  sleep(3);
}
