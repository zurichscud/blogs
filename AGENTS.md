# AGENTS.md

页边 MARGIN：手写 HTML/CSS/JS 的中文博客，用 Vite 做开发服务与打包；文章用 markdown 写、由 `scripts/` 下的 Node 脚本生成文章页。
写作流程、front matter 字段、正文约定、改样式的入口都在 `README.md`，先读它。这里只记容易踩的。

## 命令

```bash
npm install                          # marked（渲染文章页）+ vite（开发与打包）
npm run new -- type-scale "字号与行距"  # 生成 posts/type-scale.md 骨架
npm run dev                          # 开发服务 http://localhost:5173，页面在 /posts/<slug>.html
npm run gen                          # 只渲染文章页到 dist/posts/（不打包，便于对账）
npm run gen -- --out 目录            # 换输出目录；也可只生成指定的一篇
npm run build                        # vite build，产物在 dist/，文章页现算
npm run preview                      # 用 dist/ 起本地服务
```

没有测试、lint、typecheck，也没有 CI。

## 必须知道

- `posts/` 里只放 md，文章页是**现算**的：dev 由 `vite.config.js` 的 `postPages()` 中间件渲染，build 走同一个插件的虚拟入口写进 `dist/posts/`。别往 `posts/` 写生成物（`.gitignore` 已经挡住 `posts/**/*.html`），也别把生成物提交进 git。
- **支持分类子目录**：`posts/` 下的 md 会递归收集（跳过 `assets/` 与点目录），页面地址镜像目录——`posts/io/char-io.md` → `/posts/io/char-io.html`。新增一级目录不用改配置；页面里的站内相对路径按**文章自己所在目录**算（`renderPost` 把深度交给 `template.mjs` 的 `prefix`），上下篇链接由 `pageUrl()` 跨目录计算。
- **首页不会自动更新**：`index.html` 的文章链接全部指向手写的 `article.html`，生成的 `posts/*.html` 目前没有被首页引用；「近期写作 / 归档 / 栏目计数」也是手写的。`npm run gen` 不碰首页，别为了让新文章出现在首页去改它，除非用户明确要求。
- `article.html` 与 `posts/typesetting-basics.md` 是生成器的**回归基线**（后者是前者的 md 回写版，两者内容应一致）：不要当普通文章改、不要删。对账就 `npm run gen` 后拿 `dist/posts/typesetting-basics.html` 和 `article.html` 比（可见文本 / 链接 / 块级标签序列，归一化掉有意差异，例如 TOC、复制按钮外壳）。
- front matter 是手写的子集解析器，不是 YAML 库；字段白名单在 `scripts/build-post.mjs` 的 `KNOWN_FIELDS`。加字段要同时改白名单、`README.md` 的表格，要渲染就再改 `scripts/template.mjs`。
- 站点常量（站名、页脚文案、「第 014 期」）在 `scripts/template.mjs` 的 `SITE` 和 `index.html` 里各有一份，两处要一起改。
- 页面由 Vite 提供（`npm run dev` / `preview` / 子目录部署），**不要为 `file://` 直开做兼容**：打包后的 module 脚本在 `file://` 下跑不起来。页面里的 `<script>` 要保持 `type="module"`——改回 `defer` 的经典脚本 Vite 就不会打包它，生产页会没有 JS。顶层页面写死在 `vite.config.js` 的 `input` 里，新增（比如 about.html）要自己加一行；`posts/*.md` 是自动收的。`main.js` 保持无依赖的 ES5 风格（`var`、IIFE、按节编号）；前端逻辑别只依赖 rAF（后台标签页会暂停，第 3 节有实测注释）。
- **不做无障碍适配**：不用为读屏、对比度、动效偏好做专门处理，也不要为此改动现有标记与样式（例如 h2/h3 的 `##` 伪元素会进无障碍名称、代码块复制按钮的反馈只在 `aria-label` 里——都保持现状）。现有的 `aria-*` 与 `prefers-reduced-motion` 照旧保留，别顺手删。
- 注释、文案、README 一律中文。

## 改完自检

- 碰生成器 / 模板 / md：`npm run gen` 跑两遍比 md5 应一致（`dist/` 被 gitignore，`git diff` 看不到差异）；再看渲染结果是否只在预期处变。要逐项对账就拿 `dist/posts/typesetting-basics.html` 与 `article.html` 比。
- 碰样式 / 前端：`npm run dev` 在浏览器里实测，别只读 CSS。`posts/byte-io.html` 有 10 个代码块，适合当样本。
- 发布前整体过一遍：`npm run build` + `npm run preview`，确认 dist/ 里的页面能跑（资源是相对路径，`base: "./"`）。

## 有意为之，别顺手"修"

- h2 / h3 用层级区分而非井号：h2 是衬线大字加下方一条 `--rule` 分隔线，h3 是无衬线加粗、行首 `::before` 一粒朱红方块（伪元素，不进 DOM、不进目录）。不要再引入 `##` / `###` 之类的标记。
- 代码块右上角只有图标复制按钮，不显示语言；语言只进 `language-xx` 类，高亮在生成时由 highlight.js 完成——要加语言改 `build-post.mjs` 的 `LANGUAGES`，要调色就改 `styles.css` 的 `--code-*` 令牌（深浅各一套）。
- 正文 15.04px、h4 比正文小、正文列宽未收窄：用户知悉的未决项，不是 bug。
