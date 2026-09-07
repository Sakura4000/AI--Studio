import { defineConfig } from "vite";

export default defineConfig({
  // 监听所有网卡，让同一局域网设备可以通过本机 IPv4 访问。
  server: {
    host: "0.0.0.0",
    port: 5555,
  },
  preview: {
    host: "0.0.0.0",
    port: 5555,
  },
  build: {
    // 关闭额外的 modulepreload 注入，让生产入口也只加载原始 bundle 和 CSS。
    modulePreload: false,
  },
});
