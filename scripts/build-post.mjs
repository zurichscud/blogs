#!/usr/bin/env node
/* ==========================================================================
   页边 MARGIN · 文章页生成
   --------------------------------------------------------------------------
   用法：
     npm run build              生成 posts/ 下的全部文章
     npm run build -- 某篇.md   只生成指定的一篇

   markdown 约定（完整示例见 posts/typesetting-basics.md）：
     - front matter 用 --- 包起来，字段：title / date / lede / category /
       description / author / minutes / tags / cover / coverAlt / coverCaption /
       coverWidth / coverHeight / draft / prevTitle / prevUrl / nextTitle / nextUrl
     - 正文从 ## 起用，一级标题留给页面本身
     - 图片单独成段时自动包成 figure，alt 之外的说明写在标题里：![](..."图注")
     - 链接、图片路径都按 posts/ 目录写（例如 assets/a.jpg、../index.html）
     - 需要精确控制某个片段时，可以直接在 md 里写 HTML，原样输出
   ========================================================================== */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { renderPage } from "./template.mjs";
import { esc, readImageSize, formatDate, estimateMinutes, countStats, plainText } from "./util.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = join(ROOT, "posts");

const DEFAULT_AUTHOR = "林知白";
const DEFAULT_CATEGORY = "随笔";

/* --------------------------------------------------------------------------
   输出
   -------------------------------------------------------------------------- */

let notes = [];

const note = (text) => notes.push(text);
const short = (file) => relative(ROOT, file);

function report(file, message) {
  console.log(`  ${short(file)}：${message}`);
  for (const n of notes) console.log(`    · ${n}`);
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

/* 图片在仓库里的真实尺寸；远程地址和根路径不查 */
function localSize(href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("/")) return null;

  const file = join(POSTS, decodeURIComponent(href.split("#")[0].split("?")[0]));
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

const engine = new Marked({ gfm: true, smartypants: false, pedantic: false });

engine.use({
  renderer: {
    heading(token) {
      const depth = Math.min(Math.max(token.depth, 2), 4);
      if (token.depth === 1) note("正文里的一级标题按二级处理：页面标题已经是 h1");
      return `<h${depth}>${this.parser.parseInline(token.tokens ?? [])}</h${depth}>\n`;
    },

    paragraph(token) {
      const inline = token.tokens ?? [];
      if (inline.length === 1 && inline[0].type === "image") return figureTag(inline[0]);
      return `<p>${this.parser.parseInline(inline)}</p>\n`;
    },

    image(token) {
      return imgTag(token);
    },

    link(token) {
      const href = /\.md$/i.test(token.href) ? token.href.replace(/\.md$/i, ".html") : token.href;
      return `<a href="${esc(href)}"${token.title ? ` title="${esc(token.title)}"` : ""}>${this.parser.parseInline(
        token.tokens ?? [],
      )}</a>`;
    },
  },
});

/* --------------------------------------------------------------------------
   上下篇
   上一篇 = 更早发布的，下一篇 = 更新的一篇；同目录自动认，front matter 可覆盖
   -------------------------------------------------------------------------- */

function loadIndex() {
  if (!existsSync(POSTS)) return [];
  return readdirSync(POSTS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const file = join(POSTS, f);
      const { data } = splitPost(readFileSync(file, "utf8"), file);
      return { slug: basename(f, ".md"), title: data.title, date: formatDate(data.date), draft: data.draft === true };
    })
    .filter((post) => !post.draft && post.title && post.date)
    .sort((a, b) => b.date.sort - a.date.sort);
}

function pager(slug, data, index) {
  const manual = (title, url) => (title && url ? { title, url } : null);
  const at = index.findIndex((post) => post.slug === slug);

  let prev = manual(data.prevTitle, data.prevUrl);
  let next = manual(data.nextTitle, data.nextUrl);

  if (!prev && at !== -1 && at + 1 < index.length) {
    prev = { title: index[at + 1].title, url: `./${index[at + 1].slug}.html` };
  }
  if (!next && at > 0) {
    next = { title: index[at - 1].title, url: `./${index[at - 1].slug}.html` };
  }

  return {
    prev: prev && { ...prev, label: "上一篇" },
    next: next && { ...next, label: "下一篇" },
  };
}

/* --------------------------------------------------------------------------
   生成一篇
   -------------------------------------------------------------------------- */

function build(file, index) {
  const slug = basename(file, ".md");
  const { data, body } = splitPost(readFileSync(file, "utf8"), file);

  if (data.draft === true) {
    report(file, "draft: true，跳过");
    return null;
  }

  if (!data.title) throw new Error("缺 title");
  const date = formatDate(data.date);
  if (!date) throw new Error("缺 date，或者 date 不是 YYYY-MM-DD");

  const stats = countStats(body);
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
    author: data.author || DEFAULT_AUTHOR,
    dateISO: date.iso,
    dateText: date.text,
    minutes: Number.isFinite(data.minutes) ? data.minutes : estimateMinutes(body),
    cover,
    body: engine.parse(body).trimEnd() + "\n",
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
    ...pager(slug, data, index),
  });

  const out = join(POSTS, `${slug}.html`);
  writeFileSync(out, html);

  const minutes = Number.isFinite(data.minutes) ? data.minutes : estimateMinutes(body);
  report(file, `→ ${relative(ROOT, out)}（约 ${minutes} 分钟，${stats.cjk} 字${stats.words ? ` + ${stats.words} 词` : ""}）`);
  return out;
}

/* --------------------------------------------------------------------------
   命令行
   -------------------------------------------------------------------------- */

const USAGE = `用法：npm run build [-- 文章.md …]
  不带参数：生成 posts/ 下的全部 md
  带参数：  只生成指定文件（相对仓库根目录，或写绝对路径）
`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.log(USAGE);
    return;
  }

  let files;
  if (args.length) {
    files = args.map((arg) => (isAbsolute(arg) ? arg : resolve(ROOT, arg)));
    const missing = files.filter((file) => !existsSync(file));
    if (missing.length) {
      console.error(`找不到文件：${missing.map(short).join("、")}`);
      process.exitCode = 1;
      return;
    }
  } else {
    if (!existsSync(POSTS)) {
      console.error("没有 posts/ 目录");
      process.exitCode = 1;
      return;
    }
    files = readdirSync(POSTS)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => join(POSTS, f));
  }

  if (!files.length) {
    console.log("posts/ 下还没有 md");
    return;
  }

  const index = loadIndex();
  let built = 0;

  for (const file of files) {
    try {
      if (build(file, index)) built += 1;
    } catch (error) {
      report(file, `生成失败：${error.message}`);
      process.exitCode = 1;
    }
  }

  console.log(`\n共 ${files.length} 篇，生成 ${built} 页`);
}

main();
