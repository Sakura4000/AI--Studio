import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const defaultSource = path.join(
  process.env.USERPROFILE ?? "",
  "Downloads",
  "gala-studio-replica.html",
);
const sourcePath = path.resolve(process.argv[2] ?? defaultSource);
const outputPath = path.resolve(process.argv[3] ?? process.cwd());
const publicPath = path.join(outputPath, "public");

const sourceHtml = await readFile(sourcePath, "utf8");
const moduleMatches = [
  ...sourceHtml.matchAll(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/gi),
];
const styleMatches = [...sourceHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];

if (moduleMatches.length !== 1 || styleMatches.length !== 1) {
  throw new Error(
    `预期各找到一个 module 脚本和 style 标签，实际为 ${moduleMatches.length} 和 ${styleMatches.length}。`,
  );
}

const appBundle = moduleMatches[0][1];
const styles = styleMatches[0][1];

// 仅把内联载荷移动到外部文件，字符内容保持不变，避免拆分时改写业务行为。
const indexHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GALA-STUDIO Replica</title>
    <script type="module" src="/app.bundle.js"></script>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

await mkdir(publicPath, { recursive: true });
await writeFile(path.join(outputPath, "index.html"), indexHtml, "utf8");
await writeFile(path.join(publicPath, "app.bundle.js"), appBundle, "utf8");
await writeFile(path.join(publicPath, "styles.css"), styles, "utf8");

const digest = (content) =>
  createHash("sha256").update(content, "utf8").digest("hex");

console.log(`源文件：${sourcePath}`);
console.log(`输出目录：${outputPath}`);
console.log(`JavaScript：${appBundle.length} 字符，SHA-256 ${digest(appBundle)}`);
console.log(`CSS：${styles.length} 字符，SHA-256 ${digest(styles)}`);
