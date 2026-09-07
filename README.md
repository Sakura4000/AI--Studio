# GALA-STUDIO 无损拆分版

该项目从 `gala-studio-replica.html` 机械提取 JavaScript 和 CSS，不重新设计页面，也不改写原有前端业务逻辑。

## 文件结构

```text
├─ index.html                  # 页面入口
├─ public/
│  ├─ app.bundle.js           # 原 HTML 中的完整 module 脚本
│  └─ styles.css              # 原 HTML 中的完整样式
├─ scripts/
│  └─ split-original.mjs      # 可重复执行的拆分脚本
└─ _scaffold-backup/          # 上一版重设计骨架备份
```

## 使用

```bash
npm install
npm run dev
```

开发服务默认监听所有网卡。同一局域网中的设备可使用终端输出的 `Network` 地址访问，例如：

```text
http://192.168.x.x:5555/
```

默认端口为 `5555`。如果该端口已被占用，Vite 会自动选择其他端口，请以终端实际输出为准。Windows 首次询问时，需要允许该程序访问专用网络。

生产构建：

```bash
npm run build
```

重新从下载目录中的原文件提取：

```bash
npm run split
```

也可以指定其他输入文件或输出目录：

```bash
node scripts/split-original.mjs "D:/path/to/source.html" "D:/path/to/output"
```

## 说明

- 页面视觉和前端交互来自原 HTML，不是重新绘制的近似版本。
- `app.bundle.js` 仍是构建压缩后的代码；无损拆分解决文件组织问题，但不会自动恢复原始组件名和源码目录。
- `/api`、`/ws` 和 `/static` 请求保持原样，相关能力仍需要原项目的后端及静态资源支持。
