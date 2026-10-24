// Waits for the fixture video's playback second (read by the runner from a screenshot:
// control-server.ts, GET /video/seconds) to fall between EXPECT_MIN and EXPECT_MAX, and fails
// the flow if it never does. Polls for up to about a minute. Output: output.seconds.
const base = typeof MAESTRO_E2E_CONTROL_URL === 'undefined' ? 'http://127.0.0.1:3999' : MAESTRO_E2E_CONTROL_URL;
const min = Number(EXPECT_MIN);
const max = Number(EXPECT_MAX);
let seconds = -1;
for (let attempt = 0; attempt < 60; attempt++) {
  const response = http.request(base + '/video/seconds', { method: 'GET' });
  if (!response.ok) throw new Error('video clock unreadable: ' + response.status + ' ' + response.body);
  seconds = json(response.body).seconds;
  if (seconds >= min && seconds <= max) {
    output.seconds = seconds;
    break;
  }
}
if (seconds < min || seconds > max) {
  throw new Error('video is at ' + seconds + ' s, expected ' + min + '..' + max + ' s');
}
