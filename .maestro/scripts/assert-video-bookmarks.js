// Reads the fixture video's bookmark rows straight from the local database (through the runner:
// control-server.ts, GET /db/video-bookmarks) and fails the flow unless there are EXPECT_COUNT of
// them and, when EXPECT_NOTE is given, the first one carries that note. Polls for about 30 seconds,
// as the app uploads local bookmarks in the background.
const base = typeof MAESTRO_E2E_CONTROL_URL === 'undefined' ? 'http://127.0.0.1:3999' : MAESTRO_E2E_CONTROL_URL;
const count = Number(EXPECT_COUNT);
const note = typeof EXPECT_NOTE === 'undefined' || EXPECT_NOTE === '' ? null : EXPECT_NOTE;
let rows = [];
for (let attempt = 0; attempt < 60; attempt++) {
  const response = http.request(base + '/db/video-bookmarks', { method: 'GET' });
  if (!response.ok) throw new Error('database unreadable: ' + response.status + ' ' + response.body);
  rows = json(response.body).rows;
  if (rows.length === count && (note === null || (count > 0 && rows[0].note === note))) break;
  const until = Date.now() + 500;
  while (Date.now() < until) {
    // wait: Maestro scripts have no sleep
  }
}
if (rows.length !== count) {
  throw new Error('expected ' + count + ' video bookmark row(s), found ' + rows.length + ': ' + JSON.stringify(rows));
}
if (note !== null && count > 0 && rows[0].note !== note) {
  throw new Error('expected note "' + note + '", found ' + JSON.stringify(rows[0]));
}
output.rows = rows.length;
