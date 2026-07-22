import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    store_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TEST_EMAIL', 'TEST_PASSWORD'];
for (const key of required) {
  if (!__ENV[key]) throw new Error(`Missing ${key}`);
}

export function setup() {
  const response = http.post(
    `${__ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORD }),
    { headers: { apikey: __ENV.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } }
  );
  check(response, { 'test account login succeeds': r => r.status === 200 });
  const token = response.json('access_token');
  if (!token) throw new Error('The load-test account could not sign in.');
  return { token };
}

export default function (data) {
  const today = new Date().toISOString().slice(0, 10);
  const response = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/list_audit_submissions`,
    JSON.stringify({
      p_date_from: today,
      p_date_to: today,
      p_store_names: null,
      p_template_id: null,
      p_limit: 50,
      p_offset: 0,
    }),
    {
      headers: {
        apikey: __ENV.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${data.token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'audit query succeeds': r => r.status === 200,
    'audit query stays below 1.5s': r => r.timings.duration < 1500,
  });
  sleep(Math.random() * 3 + 2);
}

