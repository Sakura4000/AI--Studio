import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const sourcePath = path.resolve(process.argv[2] ?? "");
const port = Number(process.argv[3] ?? 4180);
const html = await readFile(sourcePath);

// 所有页面路径都返回同一个原型文件，模拟 SPA 服务端的 history fallback。
const server = createServer((_request, response) => {
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": html.length,
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(html);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${sourcePath} at http://127.0.0.1:${port}`);
});
