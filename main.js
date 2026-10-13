/* ==========================================================================
   页边 MARGIN
   三件事：主题切换、订阅表单的本地反馈、文章目录的滚动标位
   入场动画由 CSS 承担，这里不参与
   无依赖，无构建
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  /* ------------------------------------------------------------------------
     1. 主题
     首次绘制前由 head 里的内联脚本定妥，这里只管之后的变化
     ------------------------------------------------------------------------ */

  var THEME_KEY = "margin-theme";

  function applyTheme(theme, persist) {
    root.setAttribute("data-theme", theme);
    if (!persist) return;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  function storedTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  // 读者没有手动选过时，跟随系统设置
  function followSystem(event) {
    if (!storedTheme()) applyTheme(event.matches ? "dark" : "light", false);
  }

  if (prefersDark.addEventListener) {
    prefersDark.addEventListener("change", followSystem);
  } else if (prefersDark.addListener) {
    prefersDark.addListener(followSystem);
  }

  /* ------------------------------------------------------------------------
     2. 订阅表单
     静态站没有后端，这里只做本地校验与反馈。
     接入真实接口时替换 submit 处理即可。
     ------------------------------------------------------------------------ */

  var form = document.querySelector("[data-subscribe]");
  var note = document.querySelector("[data-subscribe-note]");
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (form && note) {
    var field = form.querySelector('input[type="email"]');

    if (field) {
      // 开始重新输入就退回中性提示
      field.addEventListener("input", function () {
        note.removeAttribute("data-state");
        note.textContent = "每月一期，随时可以退订。";
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = field ? field.value.trim() : "";

      if (!EMAIL.test(value)) {
        note.removeAttribute("data-state");
        note.textContent = "这个地址看起来不太完整，再检查一下。";
        if (field) field.focus();
        return;
      }

      note.setAttribute("data-state", "ok");
      note.textContent = "已记下。下一期在月初寄出。";
      form.reset();
    });
  }

  /* ------------------------------------------------------------------------
     3. 文章目录
     滚动时把正在读的一节标出来。页面上没有目录就什么都不做
     ------------------------------------------------------------------------ */

  var toc = document.querySelector(".toc");

  if (toc) {
    var links = [].slice.call(toc.querySelectorAll(".toc__link"));
    var targets = links.map(function (link) {
      return document.getElementById(link.getAttribute("href").slice(1));
    });

    var current = -1;

    function mark(active) {
      if (active === current) return;
      current = active;
      links.forEach(function (link, i) {
        if (i === active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }

    function update() {
      // 吸顶报头下沿再往下一点，算作「已经读到」
      var line = 120;
      var active = -1;

      for (var i = 0; i < targets.length; i += 1) {
        if (targets[i] && targets[i].getBoundingClientRect().top <= line) active = i;
      }

      // 滚到底时最后一项就是当前项
      if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2) {
        active = targets.length - 1;
      }

      mark(active);
    }

    // 滚动事件本身已按帧合并，这里直接算；不套 rAF，后台标签页里 rAF 会被暂停
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }
})();
