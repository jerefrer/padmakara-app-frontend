// Calls the runner's control server (fixtures/control-server.ts); fails the flow on an error.
// Inputs (env): CONTROL_METHOD (default POST), CONTROL_PATH. Output: output.body (response text).
const base = typeof MAESTRO_E2E_CONTROL_URL === 'undefined' ? 'http://127.0.0.1:3999' : MAESTRO_E2E_CONTROL_URL;
const method = typeof CONTROL_METHOD === 'undefined' ? 'POST' : CONTROL_METHOD;
const response = http.request(base + CONTROL_PATH, method === 'GET' ? { method: method } : { method: method, body: '{}' });
if (!response.ok) {
  throw new Error('control ' + method + ' ' + CONTROL_PATH + ' failed: ' + response.status + ' ' + response.body);
}
output.body = response.body;
