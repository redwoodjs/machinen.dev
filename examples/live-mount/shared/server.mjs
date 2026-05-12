// Tiny HTTP server that demonstrates two-way live-mount propagation.
//
//   GET  /          → returns the current contents of message.txt
//   any request     → appended to access.log
//
// Both files live under /mnt/shared, which the host has FUSE-mounted
// from its ./shared/ directory. Edits on either side show up
// immediately on the other.

import { appendFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";

const MESSAGE = "/mnt/shared/message.txt";
const LOG = "/mnt/shared/access.log";

createServer((req, res) => {
  let body;
  try {
    body = readFileSync(MESSAGE, "utf8");
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`failed to read ${MESSAGE}: ${err.message}\n`);
    return;
  }
  appendFileSync(LOG, `${new Date().toISOString()} ${req.method} ${req.url}\n`);
  res.writeHead(200, { "content-type": "text/plain" });
  res.end(body);
}).listen(3000, "0.0.0.0", () => console.log("live-mount: listening on 0.0.0.0:3000"));
