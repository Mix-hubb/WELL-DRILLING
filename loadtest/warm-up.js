import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "https://well-drilling-api.onrender.com";

export const options = {
  vus: 1,
  duration: "30s",
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health: status 200": (r) => r.status === 200 });
  sleep(3);
}
