#!/usr/bin/env node
/* ==========================================================================
   页边 MARGIN · 文章页生成
   --------------------------------------------------------------------------
   这一份既是库（vite.config.js 调它现算页面），也是命令行：
     npm run gen                 把文章页写到 dist/posts/（不打包，便于对账）
     npm run gen -- --out 目录   换一个输出目录
     npm run gen -- 某篇.md      只生成指定的一篇
   posts/ 下只放 md，生成的 .html 不再落回仓库；发布产物一律在 dist/
   （npm run dev / npm run build 会直接调这里的 renderPost，不经过磁盘）

   markdown 约定（完整示例见 posts/typesetting-basics.md）：
     - front matter 用 --- 包起来，只有 title 必填。字段：title / date / lede /
       category / description / tags / cover / coverAlt / coverCaption /
       coverWidth / coverHeight / draft /
       prevTitle / prevUrl / nextTitle / nextUrl
     - date 选填，写了就必须是 YYYY-MM-DD。页面不显示日期，它只决定上下篇顺序；
       没写日期的文章排在有日期的后面
     - 页面不显示作者和阅读时长，两者只在构建日志里出现
     - 正文从 ## 起用，一级标题留给页面本身
     - 图片单独成段时自动包成 figure，alt 之外的说明写在标题里：![](..."图注")
     - 链接、图片路径都按 posts/ 目录写（例如 assets/a.jpg、../index.html）
     - 需要精确控制某个片段时，可以直接在 md 里写 HTML，原样输出
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve, isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { renderPage } from "./template.mjs";
import { esc, readImageSize, formatDate, estimateMinutes, countStats, plainText } from "./util.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = join(ROOT, "posts");

const DEFAULT_CATEGORY = "随笔";

/* front matter 认得的字段，其余会提示忽略（顺手抓拼写错误） */
const KNOWN_FIELDS = new Set([
  "title",
  "date",
  "lede",
  "category",
  "description",
  "tags",
  "cover",
  "coverAlt",
  "coverCaption",
  "coverWidth",
  "coverHeight",
  "draft",
  "prevTitle",
  "prevUrl",
  "nextTitle",
  "nextUrl",
]);

/* --------------------------------------------------------------------------
   输出
   -------------------------------------------------------------------------- */

let notes = [];

const note = (text) => notes.push(text);
const short = (file) => relative(ROOT, file);

/* 渲染过程攒下的告警（缺图、不认识的字段…），由调用方决定怎么处理 */
export function takeNotes() {
  const out = notes;
  notes = [];
  return out;
}

function report(file, message) {
  console.log(`  ${short(file)}：${message}`);
  for (const n of takeNotes()) console.log(`    · ${n}`);
  notes = [];
}

/* --------------------------------------------------------------------------
   front matter
   够用的子集：键值、[数组]、块状 - 数组、双引号字符串、true/false、数字
   -------------------------------------------------------------------------- */

function scalar(value) {
  const v = value.trim();
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseFrontMatter(source, file) {
  const data = {};
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) throw new Error(`front matter 第 ${i + 1} 行看不懂：${line}`);
    const [, key, rest] = m;
    const value = rest.trim();

    if (value === "") {
      // 块状数组
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i += 1;
        items.push(scalar(lines[i].replace(/^\s*-\s+/, "")));
      }
      data[key] = items.length ? items : "";
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => scalar(item))
        .filter((item) => item !== "");
      continue;
    }

    data[key] = scalar(value);
  }

  return data;
}

function splitPost(raw, file) {
  const text = raw.replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) throw new Error("开头缺少 front matter（--- 包起来的那一段）");

  const end = text.indexOf("\n---", 3);
  if (end === -1) throw new Error("front matter 没有闭合，结尾缺一行 ---");

  return {
    data: parseFrontMatter(text.slice(4, end), file),
    body: text.slice(end + 4).replace(/^\n+/, "").replace(/\s+$/, "") + "\n",
  };
}

/* --------------------------------------------------------------------------
   正文渲染
   -------------------------------------------------------------------------- */

/* 图片在仓库里的真实尺寸；远程地址和根路径不查，相对路径按当前文章目录算 */
let mediaBase = POSTS;

function localSize(href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("/")) return null;

  // mediaBase 是这篇文章所在的目录：顶层文章就是 posts/，分类文章是 posts/io/ 之类
  const file = join(mediaBase, decodeURIComponent(href.split("#")[0].split("?")[0]));
  if (!existsSync(file)) {
    note(`图片文件不在仓库里，页面能引用但会 404：${href}`);
    return null;
  }

  const size = readImageSize(file);
  if (!size) note(`认不出这个图片的尺寸，img 上没有写宽高：${href}`);
  return size;
}

function imgTag(token, { lazy = true } = {}) {
  const size = localSize(token.href);
  return `<img src="${esc(token.href)}"${size ? ` width="${size.width}" height="${size.height}"` : ""}${
    lazy ? ' loading="lazy"' : ""
  } alt="${esc(token.text ?? "")}" />`;
}

/* 单独成段的图片 → figure + figcaption
   图注优先取 md 标题（![](a.jpg "图注")），没有标题就把 alt 让给图注 */
function figureTag(token) {
  const caption = token.title || token.text || "";
  const img = token.title ? token : { ...token, text: "" };
  return `<figure>\n${imgTag(img)}${caption ? `\n<figcaption>${esc(caption)}</figcaption>` : ""}\n</figure>\n`;
}

/* 标题的锚点 id：保留中英文与数字，标点换成连字符；重名往后编号 */
const seenIds = new Map();

function headingId(text) {
  const base =
    String(text)
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "sec";

  const n = (seenIds.get(base) ?? 0) + 1;
  seenIds.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/* 本篇目录，渲染时顺手收集 h2 / h3 */
let toc = [];

/* 复制按钮的两个图标：默认是「复制」，点过之后换成对勾 */
const COPY_ICONS = `<svg class="code__copy-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="code__copy-done" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

const engine = new Marked({ gfm: true, smartypants: false, pedantic: false });
engine.use({
  renderer: {
    heading(token) {
      const depth = Math.min(Math.max(token.depth, 2), 4);
      if (token.depth === 1) note("正文里的一级标题按二级处理：页面标题已经是 h1");

      const html = this.parser.parseInline(token.tokens ?? []);
      const plain = this.parser.parseInline(token.tokens ?? [], this.parser.textRenderer);
      const id = headingId(plain);
      if (depth === 2 || depth === 3) toc.push({ level: depth, id, text: plain });

      return `<h${depth} id="${esc(id)}">${html}</h${depth}>\n`;
    },

    paragraph(token) {
      const inline = token.tokens ?? [];
      if (inline.length === 1 && inline[0].type === "image") return figureTag(inline[0]);
      return `<p>${this.parser.parseInline(inline)}</p>\n`;
    },

    image(token) {
      return imgTag(token);
    },

    /* 代码块：右上角一个复制按钮。语言不再显示，language-xx 类留着，将来接高亮时现成 */
    code(token) {
      const lang = (token.lang || "").trim().split(/\s+/)[0] || "";
      const text = `${String(token.text ?? "").replace(/\n+$/, "")}\n`;
      const pre = `<pre><code${lang ? ` class="language-${esc(lang)}"` : ""}>${
        token.escaped ? text : esc(text)
      }</code></pre>`;
      const button = `<button class="code__copy" type="button" data-copy-code aria-label="复制代码">${COPY_ICONS}</button>`;

      return `<div class="code">\n${button}\n${pre}\n</div>\n`;
    },

    link(token) {
      const href = /\.md$/i.test(token.href) ? token.href.replace(/\.md$/i, ".html") : token.href;
      return `<a href="${esc(href)}"${token.title ? ` title="${esc(token.title)}"` : ""}>${this.parser.parseInline(
        token.tokens ?? [],
      )}</a>`;
    },
  },
});

/* 正文渲染：见到的相对路径都按这篇文章所在目录算 */
function render(body, baseDir = POSTS) {
  seenIds.clear();
  toc = [];
  mediaBase = baseDir;
  const html = engine.parse(body).trimEnd() + "\n";
  // 只有一节标题的目录没意义，不显示
  return { body: html, toc: toc.length >= 2 ? toc : [] };
}

/* --------------------------------------------------------------------------
   上下篇
   上一篇 = 更早发布的，下一篇 = 更新的一篇；同目录自动认，front matter 可覆盖
   没写 date 的排在有日期的后面，内部按文件名——不用文件修改时间，
   那东西在不同机器上不一样，会让生成结果抖来抖去
   -------------------------------------------------------------------------- */

export function loadIndex() {
  return listPostFiles()
    .map((file) => {
      try {
        const { data } = splitPost(readFileSync(file, "utf8"), file);
        const date = formatDate(data.date);
        return {
          slug: slugOf(file),
          title: data.title,
          date,
          // 会不会生成，跟 build 的校验保持一致：草稿、没标题、日期写了但不合法，
          // 都不该出现在别人的上下篇里（那些要么被跳过，要么会报错）
          indexable: Boolean(data.title) && !(data.date && !date) && data.draft !== true,
        };
      } catch {
        // front matter 坏了就先进不了索引，等轮到它自己生成时再报错
        return { slug: slugOf(file), indexable: false };
      }
    })
    .filter((post) => post.indexable)
    .sort((a, b) => (b.date?.sort ?? 0) - (a.date?.sort ?? 0) || a.slug.localeCompare(b.slug));
}

function pager(slug, data, index) {
  const manual = (title, url) => (title && url ? { title, url } : null);
  const at = index.findIndex((post) => post.slug === slug);

  let prev = manual(data.prevTitle, data.prevUrl);
  let next = manual(data.nextTitle, data.nextUrl);

  if (!prev && at !== -1 && at + 1 < index.length) {
    prev = { title: index[at + 1].title, url: pageUrl(slug, index[at + 1].slug) };
  }
  if (!next && at > 0) {
    next = { title: index[at - 1].title, url: pageUrl(slug, index[at - 1].slug) };
  }

  return {
    prev: prev && { ...prev, label: "上一篇" },
    next: next && { ...next, label: "下一篇" },
  };
}

/* --------------------------------------------------------------------------
   生成一篇
   -------------------------------------------------------------------------- */

/* posts/ 下所有 md（含分类子目录），跳过 assets/ 与点目录 */
export function listPostFiles() {
  if (!existsSync(POSTS)) return [];

  const out = [];
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "assets") walk(full);
      } else if (entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  };

  walk(POSTS);
  return out;
}

/* md 在 posts/ 里的位置（去掉 .md）：既是页面地址，也是产物里的目录结构 */
export function slugOf(file) {
  return relative(POSTS, file).split(sep).join("/").slice(0, -".md".length);
}

/* 从一个页面到另一个页面的相对地址，跨目录也算得对 */
function pageUrl(fromSlug, toSlug) {
  const from = fromSlug.split("/").slice(0, -1); // 当前页所在目录
  const to = toSlug.split("/");
  let same = 0;
  while (same < from.length && same < to.length - 1 && from[same] === to[same]) same += 1;

  const up = "../".repeat(from.length - same);
  return `${up || "./"}${to.slice(same).join("/")}.html`;
}

/* 会出版面的文章：草稿不算。html 是「虚拟路径」——它不在磁盘上，
   只是给 Vite 当入口 id，决定产物落在 dist/posts/<slug>.html */
export function listPages() {
  return listPostFiles()
    .filter((file) => {
      try {
        const { data } = splitPost(readFileSync(file, "utf8"), file);
        return data.draft !== true;
      } catch {
        // front matter 坏了也留在列表里：轮到它时报错，别悄悄跳过
        return true;
      }
    })
    .map((file) => {
      const slug = slugOf(file);
      return { file, slug, html: join(POSTS, `${slug}.html`) };
    });
}

/* md → 页面 HTML。草稿返回 null；校验不过就抛错。不写磁盘 */
export function renderPost(file, index = loadIndex()) {
  const slug = slugOf(file);
  const baseDir = dirname(file);
  const { data, body } = splitPost(readFileSync(file, "utf8"), file);

  if (data.draft === true) return null;

  if (!data.title) throw new Error("缺 title");
  // date 选填；写了就必须是 YYYY-MM-DD。页面上不显示日期，它只决定上下篇顺序
  const date = data.date ? formatDate(data.date) : null;
  if (data.date && !date) throw new Error(`date 不是 YYYY-MM-DD：${data.date}`);

  for (const key of Object.keys(data)) {
    if (!KNOWN_FIELDS.has(key)) note(`不认识的字段，已忽略：${key}`);
  }

  const stats = countStats(body);
  mediaBase = baseDir;
  const cover = data.cover
    ? {
        src: data.cover,
        alt: data.coverAlt ?? "",
        caption: data.coverCaption ?? "",
        // 手工指定的尺寸优先，其次是本地图片自己读出来的
        ...(data.coverWidth && data.coverHeight
          ? { width: Number(data.coverWidth), height: Number(data.coverHeight) }
          : (localSize(data.cover) ?? {})),
      }
    : null;

  const html = renderPage({
    title: data.title,
    description: data.description || data.lede || plainText(body),
    category: data.category || DEFAULT_CATEGORY,
    lede: data.lede || "",
    cover,
    // 页面比 posts/ 深几层，站内相对路径就往上退几层（posts/io/x → ../../）
    prefix: "../".repeat(slug.split("/").length),
    ...render(body, baseDir),
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
    ...pager(slug, data, index),
  });

  // 只统计，不落盘；渲染时长这类信息交给调用方写日志
  return { slug, html, minutes: estimateMinutes(body), stats };
}

/* --------------------------------------------------------------------------
   命令行：把页面写到目录里（默认 dist/posts，仓库里不留生成物）
   -------------------------------------------------------------------------- */

const USAGE = `用法：npm run gen [-- --out 目录] [文章.md …]
  不带参数：生成 posts/ 下全部 md，输出到 dist/posts
  --out 目录：换输出目录
  带参数：  只生成指定文件（相对仓库根目录，或写绝对路径）
`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.log(USAGE);
    return;
  }

  let outDir = join(ROOT, "dist", "posts");
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") {
      const value = args[i + 1];
      if (!value) {
        console.error("--out 后面要跟一个目录");
        process.exitCode = 1;
        return;
      }
      outDir = isAbsolute(value) ? value : resolve(ROOT, value);
      i += 1;
    } else {
      rest.push(args[i]);
    }
  }

  let files;
  if (rest.length) {
    files = rest.map((arg) => (isAbsolute(arg) ? arg : resolve(ROOT, arg)));
    const missing = files.filter((file) => !existsSync(file));
    if (missing.length) {
      console.error(`找不到文件：${missing.map(short).join("、")}`);
      process.exitCode = 1;
      return;
    }
  } else {
    files = listPostFiles();
    if (!files.length) {
      console.log("posts/ 下还没有 md");
      return;
    }
  }

  mkdirSync(outDir, { recursive: true });

  const index = loadIndex();
  let built = 0;

  for (const file of files) {
    try {
      const page = renderPost(file, index);
      if (!page) {
        report(file, "draft: true，跳过");
        continue;
      }

      const out = join(outDir, `${page.slug}.html`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, page.html);
      built += 1;
      report(
        file,
        `→ ${relative(ROOT, out)}（约 ${page.minutes} 分钟，${page.stats.cjk} 字${
          page.stats.words ? ` + ${page.stats.words} 词` : ""
        }）`,
      );
    } catch (error) {
      report(file, `生成失败：${error.message}`);
      process.exitCode = 1;
    }
  }

  console.log(`\n共 ${files.length} 篇，生成 ${built} 页`);
}

/* 被 vite.config.js import 时不跑命令行 */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
