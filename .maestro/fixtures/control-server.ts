// Lets a Maestro flow ask the runner for the few things a flow cannot do itself: cut the
// network, put it back, match Face ID, reset the fixture's bookmarks, read a row from the
// local database. Maestro calls it with http.request (see ../scripts/control.js).
// Listens on 127.0.0.1 only and runs a fixed list of actions, nothing a request can choose.
//
//   bun control-server.ts <port>
// Environment (set by run-all.sh): E2E_SERVICES (services.sh), E2E_DATABASE_URL (local only),
// E2E_UDID (the booted iOS simulator).
const port = Number(process.argv[2] ?? 3999);
const services = process.env.E2E_SERVICES ?? "";
const databaseUrl = process.env.E2E_DATABASE_URL ?? "";
const udid = process.env.E2E_UDID ?? "";

// The fixture's rows, from seed.sql.
const FIXTURE_EVENT = 990001;
const FIXTURE_TRACKS = "990001, 990002";
const FIXTURE_VIDEO = 990001;

async function run(cmd: string[]): Promise<{ ok: boolean; out: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  return { ok: code === 0, out: (out + err).trim() };
}

const psql = (sql: string) => run(["psql", databaseUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]);
const notify = (name: string) => run(["xcrun", "simctl", "spawn", udid, "notifyutil", "-p", name]);

// The fixture video spells its playback second in binary in eight columns (see media.sh); the
// player exposes no clock, so read the second from a screenshot of the simulator.
async function videoSeconds(): Promise<{ ok: boolean; out: string }> {
  const shot = `${process.env.E2E_WORK ?? "/tmp"}/video-shot.png`;
  const taken = await run(["xcrun", "simctl", "io", udid, "screenshot", shot]);
  if (!taken.ok && !(await Bun.file(shot).exists())) return taken;
  const size = await run(["magick", "identify", "-format", "%w %h", shot]);
  const [w, h] = size.out.split(" ").map(Number);
  let seconds = 0;
  for (let bit = 0; bit < 8; bit++) {
    const x = Math.round(((bit + 0.5) * w) / 8);
    const y = Math.round(h * 0.57);
    const px = await run(["magick", shot, "-format", `%[fx:p{${x},${y}}.r]`, "info:"]);
    if (!px.ok) return px;
    if (Number(px.out) > 0.5) seconds += 2 ** bit;
  }
  return { ok: true, out: JSON.stringify({ seconds }) };
}

// The lock cover is the launch screen's burgundy (#9b1b1b) edge to edge; the home screen is white.
// While the system Face ID prompt is up the app's own elements are hidden from the accessibility
// tree, so the cover is recognised by its colour at a few points of a screenshot.
async function lockCover(): Promise<{ ok: boolean; out: string }> {
  const shot = `${process.env.E2E_WORK ?? "/tmp"}/lock-shot.png`;
  const taken = await run(["xcrun", "simctl", "io", udid, "screenshot", shot]);
  if (!taken.ok && !(await Bun.file(shot).exists())) return taken;
  const size = await run(["magick", "identify", "-format", "%w %h", shot]);
  const [w, h] = size.out.split(" ").map(Number);
  let burgundy = 0;
  const points: [number, number][] = [[0.1, 0.3], [0.9, 0.3], [0.1, 0.7], [0.9, 0.7], [0.5, 0.2]];
  for (const [fx, fy] of points) {
    const px = await run(["magick", shot, "-format", `%[fx:int(255*p{${Math.round(fx * w)},${Math.round(fy * h)}}.r)] %[fx:int(255*p{${Math.round(fx * w)},${Math.round(fy * h)}}.g)] %[fx:int(255*p{${Math.round(fx * w)},${Math.round(fy * h)}}.b)]`, "info:"]);
    if (!px.ok) return px;
    const [r, g, b] = px.out.split(" ").map(Number);
    if (r > 120 && r < 190 && g < 70 && b < 70) burgundy++;
  }
  return { ok: true, out: JSON.stringify({ cover: burgundy === points.length, burgundyPoints: burgundy, of: points.length }) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const actions: Record<string, () => Promise<{ ok: boolean; out: string }>> = {
  // Nothing remote is reachable afterwards: no API, no object storage, no video CDN.
  "POST /network/off": () => run(["bash", services, "net-off"]),
  "POST /network/on": () => run(["bash", services, "net-on"]),
  // Leave the fixture as the flows expect it: no bookmarks, no saved progress.
  "POST /reset": async () => {
    const r = await psql(`
      DELETE FROM event_bookmarks WHERE event_id = ${FIXTURE_EVENT};
      DELETE FROM track_bookmarks WHERE track_id IN (${FIXTURE_TRACKS});
      DELETE FROM video_bookmarks WHERE video_id = ${FIXTURE_VIDEO};
      DELETE FROM video_progress WHERE video_id = ${FIXTURE_VIDEO};
      DELETE FROM user_progress WHERE track_id IN (${FIXTURE_TRACKS});`);
    return r;
  },
  // JSON, so a flow can assert on it.
  "GET /db/video-bookmarks": async () => {
    const r = await psql(
      `SELECT coalesce(json_agg(json_build_object('videoId', video_id, 'positionSeconds', position_seconds, 'note', note) ORDER BY position_seconds), '[]'::json) FROM video_bookmarks WHERE video_id = ${FIXTURE_VIDEO}`,
    );
    return r.ok ? { ok: true, out: JSON.stringify({ rows: JSON.parse(r.out) }) } : r;
  },
  "GET /video/seconds": videoSeconds,
  "GET /screen/lock-cover": lockCover,
  // Face ID on the simulator. The match is sent several times: it only counts while the app
  // is waiting for it, and that moment is not visible from outside.
  "POST /face-id/enroll": async () => {
    await run(["xcrun", "simctl", "spawn", udid, "notifyutil", "-s", "com.apple.BiometricKit.enrollmentChanged", "1"]);
    return notify("com.apple.BiometricKit.enrollmentChanged");
  },
  "POST /face-id/match": async () => {
    let last = { ok: true, out: "" };
    for (let i = 0; i < 6; i++) {
      last = await notify("com.apple.BiometricKit_Sim.pearl.match");
      await sleep(1000);
    }
    return last;
  },
};

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    const action = actions[`${req.method} ${url.pathname}`];
    if (!action) return new Response("unknown action", { status: 404 });
    const result = await action();
    console.log(`${req.method} ${url.pathname} -> ${result.ok ? "ok" : "FAILED"} ${result.ok ? "" : result.out}`);
    return new Response(result.out, {
      status: result.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  },
});
console.log(`control-server: http://127.0.0.1:${port}`);
