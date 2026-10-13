#!/usr/bin/env node
/* ==========================================================================
   页边 MARGIN · 新建一篇
   --------------------------------------------------------------------------
   用法：
     npm run new -- my-post-slug "文章标题"
     npm run new -- io/char-io "字符流"      分类子目录也行，目录会自动建
   在 posts/ 下生成对应的 .md（不覆盖已有文件），填完跑 npm run gen。
   ========================================================================== */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDate } from "./util.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = join(ROOT, "posts");

const [slug, title] = process.argv.slice(2);

if (!slug || !/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(slug)) {
  console.error(`用法：npm run new -- 文件名-slug "文章标题"
文件名只用小写字母、数字和连字符，可以用目录分类，例如：
  npm run new -- type-scale "字号与行距"
  npm run new -- io/char-io "字符流"`);
  process.exitCode = 1;
} else {
  const file = join(POSTS, `${slug}.md`);

  if (existsSync(file)) {
    console.error(`已经有一篇了，没有动它：posts/${slug}.md`);
    process.exitCode = 1;
  } else {
    const today = formatDate(new Date().toISOString().slice(0, 10));
    const name = slug.split("/").pop();

    mkdirSync(dirname(file), { recursive: true });

    writeFileSync(
      file,
      `---
title: ${title || "标题"}
date: ${today.iso}
category: 随笔
lede: 一句话导语，会显示在标题下面。
description: 给搜索引擎和分享卡片用的一句话，不写就取 lede。
tags: []
# cover: assets/${name}.jpg
# coverAlt: ""
---

第一段当开场白写，页面上会稍大一号。

## 第一个小节

正文。
`,
    );

    console.log(`已新建 posts/${slug}.md（页面地址 /posts/${slug}.html）
填完正文后跑：npm run gen（看效果用 npm run dev）
图片放在这篇文章旁边的 assets/ 下，正文里写 ![说明](assets/文件名.jpg)`);
  }
}
