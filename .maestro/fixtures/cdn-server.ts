// Stand-in for the Bunny CDN, for the e2e run only. The API's HLS proxy fetches its playlists
// from https://<BUNNY_STREAM_CDN_HOSTNAME>/<guid>/... and redirects segment requests there, so the
// stand-in has to speak https; the e2e runner trusts its throwaway CA. Serves <root>/<guid>/...
// without checking the token: this is test data on localhost.
//
//   bun cdn-server.ts <root> <tls-dir> [port]
import { join, normalize } from "node:path";

const [root, tlsDir, port = "9443"] = process.argv.slice(2);
if (!root || !tlsDir) throw new Error("usage: bun cdn-server.ts <root> <tls-dir> [port]");

const types: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
};

Bun.serve({
  port: Number(port),
  // Both stacks: "localhost" resolves to ::1 first, and the player does not fall back to IPv4.
  hostname: "::",
  tls: { cert: Bun.file(join(tlsDir, "server.pem")), key: Bun.file(join(tlsDir, "server.key")) },
  async fetch(req) {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname));
    console.log(`${req.method} ${path} ${req.headers.get("range") ?? ""}`);
    if (path.includes("..")) return new Response("bad path", { status: 400 });
    const file = Bun.file(join(root, path));
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    const ext = path.slice(path.lastIndexOf("."));
    return new Response(file, {
      headers: { "Content-Type": types[ext] ?? "application/octet-stream", "Access-Control-Allow-Origin": "*" },
    });
  },
});
console.log(`cdn-server: https://localhost:${port} serving ${root}`);
