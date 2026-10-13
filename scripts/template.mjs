/* ==========================================================================
   页边 MARGIN · 文章页模板
   --------------------------------------------------------------------------
   结构与 article.html（手写版）保持一致，改这里等于改全站文章页。
   生成的页面放在 posts/ 下，所以站内相对路径统一带 ../ 前缀。
   ========================================================================== */

import { esc } from "./util.mjs";

const HOME = "../index.html";

/* 站点常量，与 index.html 的报头、页脚对齐 */
const SITE = {
  zh: "页边",
  en: "Margin",
  brand: "页边 MARGIN",
  blurb: "一个关于排版、界面与写作的长期笔记。二〇二三年开始写，不定期更新。",
  issue: "第 014 期，2026 年 10 月",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Noto+Serif+SC:wght@400..700&display=swap";

/* 主题在首次绘制前定妥，避免闪白。与 index.html / article.html 里的同一段 */
const THEME_BOOT = `<script>
      (function () {
        try {
          var saved = localStorage.getItem("margin-theme");
          var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
        } catch (e) {
          /* 存储不可用时保持默认纸色 */
        }
      })();
    </script>`;

/* --------------------------------------------------------------------------
   正文缩进
   <pre> 里的空格是有意义的，那几行原样保留
   -------------------------------------------------------------------------- */

function indent(html, unit = " ".repeat(10)) {
  let inPre = false;
  return String(html)
    .trimEnd()
    .split("\n")
    .map((line) => {
      const out = inPre ? line : unit + line;
      if (line.includes("<pre")) inPre = true;
      if (line.includes("</pre>")) inPre = false;
      return out;
    })
    .join("\n");
}

/* --------------------------------------------------------------------------
   页面
   -------------------------------------------------------------------------- */

export function renderPage(post) {
  const {
    title,
    description,
    category,
    lede,
    author,
    dateISO,
    dateText,
    minutes,
    cover,
    body,
    tags = [],
    prev = null,
    next = null,
  } = post;

  const coverHTML = cover
    ? `
        <figure class="article__cover container reveal" style="--reveal-delay: 200ms">
          <img
            src="${esc(cover.src)}"${cover.width ? `\n            width="${cover.width}"` : ""}${cover.height ? `\n            height="${cover.height}"` : ""}
            alt="${esc(cover.alt)}"
          />${cover.caption ? `\n          <figcaption>${esc(cover.caption)}</figcaption>` : ""}
        </figure>
`
    : "";

  const tagsHTML = tags.length
    ? `
          <div class="tags">
${tags.map((t) => `            <a class="tag" href="${HOME}#topics">${esc(t)}</a>`).join("\n")}
          </div>`
    : "";

  const pagerItem = (item) =>
    item
      ? `
            <a class="pager__item" href="${esc(item.url)}">
              <span class="pager__label">${esc(item.label)}</span>
              <span class="pager__title">${esc(item.title)}</span>
            </a>`
      : "";

  const pagerHTML =
    prev || next
      ? `          <nav class="pager" aria-label="上下篇">${pagerItem(prev)}${pagerItem(next)}
          </nav>`
      : "";

  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)} · ${SITE.brand}</title>
    <meta name="description" content="${esc(description)}" />

    ${THEME_BOOT}

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${FONTS}" />
    <link rel="stylesheet" href="../styles.css" />
  </head>

  <body>
    <a class="skip-link" href="#main">跳到正文</a>

    <!-- 阅读进度，用滚动驱动动画实现，不支持的浏览器不显示 -->
    <div class="progress" aria-hidden="true"></div>

    <header class="masthead">
      <div class="container masthead__inner">
        <a class="wordmark" href="${HOME}" aria-label="${SITE.brand} 首页">
          <span class="wordmark__zh">${SITE.zh}</span>
          <span class="wordmark__en">${SITE.en}</span>
        </a>

        <nav class="nav" aria-label="主导航">
          <a class="nav__link" href="${HOME}" aria-current="page">文章</a>
          <a class="nav__link" href="${HOME}#topics">栏目</a>
          <a class="nav__link" href="${HOME}#subscribe">订阅</a>
        </nav>

        <button class="theme-toggle" type="button" data-theme-toggle aria-label="切换深浅色主题">
          <span class="theme-toggle__dial" aria-hidden="true"></span>
        </button>
      </div>
    </header>

    <main id="main">
      <article>
        <!-- ================================================================
             标题区
             ================================================================ -->
        <header class="article__head container">
          <p class="eyebrow reveal">${esc(category)}</p>

          <h1 class="article__title display reveal" style="--reveal-delay: 60ms">
            ${esc(title)}
          </h1>
${
    lede
      ? `
          <p class="article__lede reveal" style="--reveal-delay: 110ms">
            ${esc(lede)}
          </p>
`
      : ""
  }
          <p class="meta article__byline reveal" style="--reveal-delay: 160ms">
            <span>${esc(author)}</span>${
    dateText
      ? `
            <span class="meta__sep" aria-hidden="true"></span>
            <time datetime="${esc(dateISO)}">${esc(dateText)}</time>`
      : ""
  }
            <span class="meta__sep" aria-hidden="true"></span>
            <span>约 ${minutes} 分钟</span>
          </p>
        </header>
${coverHTML}
        <!-- ================================================================
             正文
             ================================================================ -->
        <div class="prose container">
${indent(body)}
        </div>

        <!-- ================================================================
             文末
             ================================================================ -->
        <footer class="article__foot container">${tagsHTML}${pagerHTML ? `\n\n${pagerHTML}` : ""}
        </footer>
      </article>
    </main>

    <footer class="footer">
      <hr class="rule-ink" />
      <div class="container">
        <div class="footer__grid">
          <div>
            <p class="footer__title">${SITE.zh}</p>
            <p class="footer__blurb">
              ${SITE.blurb}
            </p>
          </div>

          <nav aria-label="页脚导航">
            <h2 class="footer__heading">浏览</h2>
            <div class="footer__list">
              <a href="${HOME}">文章</a>
              <a href="${HOME}#topics">栏目</a>
              <a href="${HOME}#subscribe">订阅</a>
            </div>
          </nav>

          <div>
            <h2 class="footer__heading">订阅渠道</h2>
            <div class="footer__list">
              <a href="${HOME}#subscribe">邮件</a>
              <a href="${HOME}#subscribe">RSS</a>
              <a href="${HOME}#subscribe">GitHub</a>
            </div>
          </div>
        </div>

        <div class="footer__baseline">
          <span>© 2026 ${SITE.zh}</span>
          <span>${SITE.issue}</span>
        </div>
      </div>
    </footer>

    <script src="../main.js" defer></script>
  </body>
</html>
`;
}
