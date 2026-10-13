/* ==========================================================================
   页边 MARGIN · 生成脚本共用的小工具
   转义、读图片尺寸、日期、字数统计
   ========================================================================== */

import { readFileSync } from "node:fs";

/* --------------------------------------------------------------------------
   转义
   -------------------------------------------------------------------------- */

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* --------------------------------------------------------------------------
   读取本地图片的像素尺寸
   写入 img 的 width/height，避免图片加载时页面跳动。
   认得出 PNG / JPEG / GIF / WebP 四种，认不出就返回 null（不写宽高，不影响显示）。
   -------------------------------------------------------------------------- */

export function readImageSize(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }

  if (buf.length < 24) return null;

  // PNG：8 字节签名 + 块长 + "IHDR"，宽高各 4 字节大端
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString("latin1", 12, 16) === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF：屏幕描述符里是 2 字节小端
  if (buf.toString("latin1", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // JPEG：逐个标记往后跳，遇到 SOFn 段就读宽高
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const size = buf.readUInt16BE(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + size;
    }
    return null;
  }

  // WebP：RIFF 容器，三种编码方式各自记宽高
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const chunk = buf.toString("latin1", 12, 16);
    if (chunk === "VP8X") {
      return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
    if (chunk === "VP8L" && buf[20] === 0x2f) {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 " && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }

  return null;
}

/* --------------------------------------------------------------------------
   日期
   只认 YYYY-MM-DD，顺手给出页面显示用的中文格式
   -------------------------------------------------------------------------- */

export function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  return {
    iso: `${y}-${mo}-${d}`,
    text: `${y} 年 ${Number(mo)} 月 ${Number(d)} 日`,
    sort: Number(`${y}${mo}${d}`),
  };
}

/* --------------------------------------------------------------------------
   字数与阅读时长
   中文按字算，西文按词算，400 字 / 220 词每分钟，向上取整到分钟
   -------------------------------------------------------------------------- */

export function countStats(md) {
  const text = String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
  const cjk = (text.match(/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const words = (text.match(/[A-Za-z0-9]+(?:[.'’-][A-Za-z0-9]+)*/g) || []).length;
  return { cjk, words };
}

export function estimateMinutes(md) {
  const { cjk, words } = countStats(md);
  return Math.max(1, Math.ceil(cjk / 400 + words / 220));
}

/* --------------------------------------------------------------------------
   取正文纯文本，给 meta description 兜底
   -------------------------------------------------------------------------- */

export function plainText(md, limit = 90) {
  const text = String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*<[^>]+>\s*$/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
