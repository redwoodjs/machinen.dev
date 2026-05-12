import { createServer } from "node:http";

let count = 0;

createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ count: ++count }) + "\n");
}).listen(3000, "0.0.0.0", () => {
  console.log("counter: listening on 0.0.0.0:3000");
});
