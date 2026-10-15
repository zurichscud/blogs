# 页边 MARGIN

一个关于排版、界面与写作的中文博客。页面是手写的 HTML/CSS/JS，由 Vite 提供开发服务和打包；文章用 markdown 写，文章页在 dev / build 时现算。

## 目录

```
index.html        首页
article.html      手写文章页。它同时是生成器的参照样本，改版时用来对账
styles.css        全站样式，含 .prose（正文排版）
main.js           主题切换、订阅表单的前端反馈
vite.config.js    Vite 配置：页面入口、文章页插件、相对 base
posts/            文章源文件（只有 .md，可按分类分子目录）；assets/ 放配图
scripts/          生成脚本（build-post.mjs 既是库也是 npm run gen）
dist/             npm run build 的产物，文章页在 dist/posts/；不进仓库
```

## 环境

Node 20.19 以上或 22.12 以上（`vite` 的要求；`marked` 只要 20）。

```bash
npm install
```

## 写一篇

```bash
npm run new -- type-scale "字号与行距"   # 生成 posts/type-scale.md 骨架
npm run new -- io/char-io "字符流"       # 分类子目录也行，目录自动建
# …填正文…
npm run dev                              # 本地预览：http://localhost:5173/posts/io/char-io.html
```

文件名（slug）只用小写字母、数字和连字符，可以用目录分类。页面地址就是 `posts/<slug>.html`（`posts/io/char-io.md` → `/posts/io/char-io.html`），但磁盘上没有这些文件——`posts/` 只放 md，文章页由 `scripts/build-post.mjs` 现算：dev 直接吐给你，build 时按同样的目录结构写进 `dist/posts/`。

## 开发与部署

```bash
npm run dev       # 开发服务：改 md / styles.css / main.js，页面自动重载
npm run gen       # 只渲染文章页到 dist/posts/（不打包，便于对账、比对 diff）
npm run build     # 打包：文章页现算，产物在 dist/，部署它
npm run preview   # 用生产产物起一个本地服务，发布前看一眼
```

`base` 是相对路径，`dist/` 放在域名根目录或任意子目录都能跑。改 md 不用重跑 gen，dev 与 build 都会重新渲染。

## front matter

整段都可以不写。写了的话，除 `title` 外都可省；`title` 也能省，页面标题按「front matter 的 `title` → 正文里第一个一级标题 → 文件名（去掉 `.md`）」的顺序取。用正文里的 `#` 当标题时，那一行不再在正文里出现；两条退路都没有，构建时会打印一句。

| 字段 | 说明 |
| --- | --- |
| `title` | 选填。页面标题，也是 `<title>`；不写就取正文里第一个 `#` 标题，再不行用文件名 |
| `date` | 选填，`YYYY-MM-DD`。页面不显示日期，它只决定上下篇顺序：没写日期的文章排在有日期的后面（内部按文件名） |
| `lede` | 标题下面的一句话导语 |
| `category` | 标题上方的小字（栏目），默认「随笔」 |
| `description` | 分享卡片和搜索引擎用的一句话。不写取 `lede`，再取正文前 90 字 |
| `tags` | `[排版, 中文]`，或块状 `- 排版` 一行一个 |
| `cover` / `coverAlt` / `coverCaption` | 封面图、无障碍描述、图注，都可省 |
| `coverWidth` / `coverHeight` | 远程封面读不到尺寸时手写，避免加载时跳动 |
| `draft` | `true` 时不生成，也不出现在别人的上下篇里 |
| `prevTitle` + `prevUrl` / `nextTitle` + `nextUrl` | 手工指定上下篇；不写就按日期自动算 |

## 正文约定

- 一级标题留给页面本身，正文从 `##` 开始。写了 `#` 会按二级处理并提示一句；只有 front matter 没写 `title` 时例外——正文里第一个 `#` 会当页面标题，并从正文里去掉。`##` / `###` 会自动进右侧目录（至少两条才显示），标题自带可用于分享的锚点 id
- 第一段在页面上会稍大一号（CSS 的 `:first-of-type`），当开场白写
- 单独成段的图片自动包成 `figure`：`![说明](assets/a.jpg "图注")`。图注优先取引号里的文字；只写了 alt 时，alt 当图注。夹在句子里的图片保持行内
- 图片路径和链接都按**文章自己所在目录**写：顶层文章写 `assets/a.jpg`、`../index.html#topics`；放进 `posts/io/` 这种分类目录的文章顺着目录上下走（图片可以是它旁边的 `assets/`，回首页写 `../../index.html`）。上下篇链接由生成器按目录算，不用手写
- 指向另一篇文章的 `.md` 链接会自动改成 `.html`
- 需要精确控制某个片段时，直接在 md 里写 HTML，原样输出
- 表格、代码块有样式。标了语言的代码块在生成时用 highlight.js 上色（认得哪几种见 `scripts/build-post.mjs` 里的 `LANGUAGES`，要加一门就在那张表里添一行），配色来自 `styles.css` 的 `--code-*` 令牌，深浅主题各自一套；语言不在页面上显示，只留在 `language-xx` 类里。没标语言的块按纯文本输出；写了没注册的语言同样按纯文本输出，构建时打印一句
- 代码块右上角有一个图标复制按钮：点一下复制整段代码，图标变成对勾、1.6 秒后复原（无障碍标签同步变成「已复制」）。按钮不参与选中，复制内容里不会有它。在非安全上下文（比如局域网 http）打开时自动退回旧的复制方式

## 生成器做的事

- front matter → 标题区、封面、文末 tags
- 文章页的标题区只有「栏目 / 标题 / 导语」三行；作者、日期、阅读时长都不上页面（阅读时长只打印在构建日志里）
- 上下篇：按日期排序，**上一篇是更早的那篇，下一篇是更新的那篇**，草稿不参与；`prevTitle` / `prevUrl` 之类可以覆盖。没写 `date` 的文章排在有日期的后面
- 目录：把正文的 `h2` / `h3` 收成右侧一栏（宽屏才显示），锚点 id 由标题文字生成，重名自动加序号；滚动时标出正在读的一节。标题不够两条就不生成目录
- 本地图片读出像素宽高写进 `<img>`，远程图片不写
- 代码块用 highlight.js 上色，认得哪几种语言由 `build-post.mjs` 的 `LANGUAGES` 决定，颜色写在 `styles.css` 的 `--code-*` 令牌里
- `date` 写了但不是 `YYYY-MM-DD`、以 `---` 开头却少了结尾那行 `---` → 这一篇报错；`npm run gen` 跳过它并以非零码退出，`npm run build` 直接失败
- 图片文件不在仓库里、认不出尺寸、写了不认识的 front matter 字段、标题只能退到文件名 → 打印告警但照常生成

## 改样式、改骨架

- 改样式用 `npm run dev`：`styles.css` 的改动即时生效，不用手动刷新
- 颜色、字体、间距都在 `styles.css` 开头的变量里；正文排版看文件里「正文」那一段的 `.prose …` 规则
- 目录的样式在 `styles.css` 的 `.toc …` 一段（`@media (min-width: 1080px)` 里是分栏与吸顶），当前节的标位逻辑在 `main.js` 第 3 节，代码块复制在第 4 节
- 文章页骨架在 `scripts/template.mjs`，改它等于改全站文章页；文章页怎么接进 Vite（虚拟入口 + dev 中间件）在 `vite.config.js` 的 `postPages()` 里
- 站名、页脚文案、「第 014 期」这类站点常量在 `template.mjs` 的 `SITE` 对象里；首页里还有一份，两处要一起改

## 还没做的

- 首页的「近期写作」「年份归档」「栏目计数」仍是手工维护
- 目录（TOC）、RSS 输出
- `article.html` 是对账用的参照样本，等内容稳定后可以删掉
