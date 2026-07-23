/**
 * Minimal Markdown → HTML for site build (no external deps).
 * Supports: ATX headings, paragraphs, fenced code, tables, lists, links, bold/code, blockquotes, hr, details-ish HTML passthrough.
 */
export function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf = [];
  let listType = null;
  let tableBuf = [];

  function flushList() {
    if (!listType) return;
    out.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  }

  function flushTable() {
    if (!tableBuf.length) return;
    const rows = tableBuf.filter((r) => !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(r));
    if (!rows.length) {
      tableBuf = [];
      return;
    }
    out.push("<table>");
    rows.forEach((row, idx) => {
      const cells = row
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      const tag = idx === 0 ? "th" : "td";
      out.push("<tr>" + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>");
    });
    out.push("</table>");
    tableBuf = [];
  }

  function inline(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      flushList();
      flushTable();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
      } else {
        out.push(
          `<pre><code${codeLang ? ` class="language-${codeLang}"` : ""}>${codeBuf
            .join("\n")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</code></pre>`,
        );
        inCode = false;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // Pass through simple HTML blocks (details, etc.)
    if (line.startsWith("<") && !line.startsWith("<http")) {
      flushList();
      flushTable();
      out.push(line);
      i++;
      continue;
    }

    if (/^\|/.test(line) && line.includes("|", 1)) {
      flushList();
      tableBuf.push(line);
      i++;
      continue;
    } else {
      flushTable();
    }

    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#+\s+/, "");
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushList();
      out.push("<hr />");
      i++;
      continue;
    }

    if (line.trim() === "") {
      flushList();
      i++;
      continue;
    }

    flushList();
    // paragraph: gather until blank
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^#{1,6}\s/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\|/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) && !/^>\s?/.test(lines[i])) {
      if (lines[i].startsWith("<")) break;
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  flushList();
  flushTable();
  return out.join("\n");
}

export function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    data[k] = v;
  }
  return { data, body: text.slice(m[0].length) };
}
