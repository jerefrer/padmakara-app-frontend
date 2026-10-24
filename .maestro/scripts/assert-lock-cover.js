// Fails the flow unless the screen is (EXPECT_COVER = "true") or is not ("false") the app-lock
// cover, judged by the runner from a screenshot (control-server.ts, GET /screen/lock-cover).
// Polls for up to about 30 seconds, as the cover and the system prompt come and go.
const base = typeof MAESTRO_E2E_CONTROL_URL === 'undefined' ? 'http://127.0.0.1:3999' : MAESTRO_E2E_CONTROL_URL;
const want = EXPECT_COVER === 'true';
let cover = null;
for (let attempt = 0; attempt < 30; attempt++) {
  const response = http.request(base + '/screen/lock-cover', { method: 'GET' });
  if (!response.ok) throw new Error('screen unreadable: ' + response.status + ' ' + response.body);
  cover = json(response.body).cover;
  if (cover === want) break;
  const until = Date.now() + 1000;
  while (Date.now() < until) {
    // wait: Maestro scripts have no sleep
  }
}
if (cover !== want) {
  throw new Error('expected the lock cover to be ' + (want ? 'showing' : 'gone') + ', but it is ' + (cover ? 'showing' : 'not showing'));
}
