/* ==========================================================================
   页边 MARGIN · Vite 配置
   --------------------------------------------------------------------------
   页面入口 = index.html、article.html，以及 posts/ 下每个 .md 对应的文章页
   文章页是现算的：dev 走中间件，build 走虚拟入口，产物落 dist/posts/
   posts/ 里只放 md，生成的 .html 不落回仓库

   base 用相对路径：产物放进任何子目录都能跑，沿用站点「所有链接都相对」的老规矩
   ========================================================================== */

import { existsSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { defineConfig } from "vite";
import { listPages, loadIndex, renderPost, takeNotes } from "./scripts/build-post.mjs";

const root = import.meta.dirname;
const POSTS = resolve(root, "posts");

/* --------------------------------------------------------------------------
   文章页插件
   - resolveId / load：给 Vite 一个「虚拟的」posts/<slug>.html 入口，
     内容由 renderPost 现算。id 用真实路径，产物才会按目录结构落到 dist/
   - configureServer：dev 下没有磁盘文件，得自己截住 /posts/<slug>.html，
     再交给 transformIndexHtml 走正常的 HTML 处理（注入 vite client、改写资源）
   -------------------------------------------------------------------------- */

function postPages() {
  const logged = new Set();

  /* 文件系统路径（或相对 root 的 id）→ { html, md }；不是文章页就 null */
  function match(id) {
    const clean = id.split("?")[0].split("#")[0];
    if (!clean.endsWith(".html")) return null;

    const html = isAbsolute(clean) ? clean : resolve(root, clean);
    if (!html.startsWith(POSTS + sep)) return null;

    const md = `${html.slice(0, -".html".length)}.md`;
    return existsSync(md) ? { html, md } : null;
  }

  const announce = (warn, message) => {
    if (!message || logged.has(message)) return;
    logged.add(message);
    warn(`文章页：${message}`);
  };

  return {
    name: "margin:post-pages",

    resolveId(id) {
      const hit = match(id);
      return hit ? hit.html : null;
    },

    load(id) {
      const hit = match(id);
      if (!hit) return null;

      const page = renderPost(hit.md, loadIndex());
      for (const message of takeNotes()) announce((text) => this.warn(text), message);
      if (!page) return null;

      return page.html;
    },

    configureServer(server) {
      // /posts/<slug>.html：磁盘上没有这个文件，渲染出来再走 Vite 的 HTML 流程
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        const hit = match(join(root, (req.url || "").split("?")[0]));
        if (!hit) return next();

        let page;
        try {
          page = renderPost(hit.md, loadIndex());
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(`文章页生成失败：${error.message}\n`);
          return;
        }
        for (const message of takeNotes()) announce((text) => server.config.logger.warn(text), message);
        if (!page) return next(); // 草稿：当作没有这个页面

        server.transformIndexHtml(req.url, page.html).then(
          (html) => {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          },
          (error) => next(error),
        );
      });

      // md 一改就整页重载（页面是现算的，改完重新渲染即可）
      const onMarkdown = (file) => {
        if (file.endsWith(".md") && file.startsWith(POSTS + sep)) {
          server.ws.send({ type: "full-reload", path: "*" });
        }
      };
      server.watcher.on("change", onMarkdown);
      server.watcher.on("add", onMarkdown);
      server.watcher.on("unlink", onMarkdown);
    },
  };
}

/* 每个会出版面的 md 一个入口；html 是虚拟路径，Vite 按它决定产物位置 */
const postInputs = Object.fromEntries(
  listPages().map(({ slug, html }) => [`posts/${slug}`, html]),
);

export default defineConfig({
  base: "./",
  input: {
    index: resolve(root, "index.html"),
    article: resolve(root, "article.html"),
    ...postInputs,
  },
  build: {
    outDir: "dist",
  },
  plugins: [postPages()],
});
