# 页边 MARGIN

一个关于排版、界面与写作的中文博客。没有框架、没有打包器：页面是手写的 HTML/CSS/JS，文章用 markdown 写，跑一个脚本生成文章页。

## 目录

```
index.html        首页
article.html      手写文章页。它同时是生成器的参照样本，改版时用来对账
styles.css        全站样式，含 .prose（正文排版）
main.js           主题切换、订阅表单的前端反馈
posts/            文章：源文件 .md 和生成结果 .html 放在一起
posts/assets/     文章配图（放图时才出现）
scripts/          生成脚本
```

## 环境

Node 20 以上（`marked` 的要求）。

```bash
npm install
```

## 写一篇

```bash
npm run new -- type-scale "字号与行距"   # 生成 posts/type-scale.md 骨架
# …填正文…
npm run build                            # 生成 posts/type-scale.html
npm run build -- posts/type-scale.md     # 也可以只生成指定的一篇
```

文件名（slug）只用小写字母、数字和连字符。生成的 HTML 是发布产物，和 md 一起提交进 git；部署时把仓库内容直接交给静态托管即可，不需要再构建。

## front matter

除 `title` 外都可省。

| 字段 | 说明 |
| --- | --- |
| `title` | 必填。页面标题，也是 `<title>` |
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

- 一级标题留给页面本身，正文从 `##` 开始。写了 `#` 会按二级处理并提示一句
- 第一段在页面上会稍大一号（CSS 的 `:first-of-type`），当开场白写
- 单独成段的图片自动包成 `figure`：`![说明](assets/a.jpg "图注")`。图注优先取引号里的文字；只写了 alt 时，alt 当图注。夹在句子里的图片保持行内
- 图片路径和链接都按 `posts/` 目录写：`assets/a.jpg`、`../index.html#topics`
- 指向另一篇文章的 `.md` 链接会自动改成 `.html`
- 需要精确控制某个片段时，直接在 md 里写 HTML，原样输出
- 表格、代码块有样式；代码块暂时没有语法高亮（生成的 `<code>` 带 `language-xx` 类，将来接高亮时现成）

## 生成器做的事

- front matter → 标题区、封面、文末 tags
- 文章页的标题区只有「栏目 / 标题 / 导语」三行；作者、日期、阅读时长都不上页面（阅读时长只打印在构建日志里）
- 上下篇：按日期排序，**上一篇是更早的那篇，下一篇是更新的那篇**，草稿不参与；`prevTitle` / `prevUrl` 之类可以覆盖。没写 `date` 的文章排在有日期的后面
- 本地图片读出像素宽高写进 `<img>`，远程图片不写
- 缺 `title`、`date` 写了但不是 `YYYY-MM-DD`、front matter 没闭合 → 这一篇报错跳过，命令以非零码退出
- 图片文件不在仓库里、认不出尺寸、写了不认识的 front matter 字段 → 打印告警但照常生成

## 改样式、改骨架

- 颜色、字体、间距都在 `styles.css` 开头的变量里；正文排版看文件里「正文」那一段的 `.prose …` 规则
- 文章页骨架在 `scripts/template.mjs`，改它等于改全站文章页
- 站名、页脚文案、「第 014 期」这类站点常量在 `template.mjs` 的 `SITE` 对象里；首页里还有一份，两处要一起改

## 还没做的

- 首页的「近期写作」「年份归档」「栏目计数」仍是手工维护
- 代码高亮、目录（TOC）、RSS 输出
- `article.html` 是对账用的参照样本，等内容稳定后可以删掉
