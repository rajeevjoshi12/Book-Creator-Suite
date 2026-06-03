export function htmlToPlainText(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "$1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n")
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function plainTextToHtml(text: string): string {
  if (!text) return "<p></p>";
  if (text.startsWith("<")) return text;
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      return `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

export function formatPageContent(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const body = doc.body;

  body.querySelectorAll<HTMLElement>("h1").forEach((h) => {
    h.style.fontFamily = "'Times New Roman', Times, serif";
    h.style.fontSize = "18pt";
    h.style.fontWeight = "bold";
    h.style.marginBottom = "0.4em";
    h.style.marginTop = "0.8em";
    h.style.lineHeight = "1.3";
  });

  body.querySelectorAll<HTMLElement>("h2").forEach((h) => {
    h.style.fontFamily = "'Times New Roman', Times, serif";
    h.style.fontSize = "16pt";
    h.style.fontWeight = "bold";
    h.style.marginBottom = "0.4em";
    h.style.marginTop = "0.8em";
    h.style.lineHeight = "1.3";
  });

  body.querySelectorAll<HTMLElement>("h3").forEach((h) => {
    h.style.fontFamily = "'Times New Roman', Times, serif";
    h.style.fontSize = "14pt";
    h.style.fontWeight = "bold";
    h.style.fontStyle = "italic";
    h.style.marginBottom = "0.3em";
    h.style.marginTop = "0.6em";
    h.style.lineHeight = "1.3";
  });

  body.querySelectorAll<HTMLElement>("h4, h5, h6").forEach((h) => {
    h.style.fontFamily = "'Times New Roman', Times, serif";
    h.style.fontSize = "12pt";
    h.style.fontWeight = "bold";
    h.style.marginBottom = "0.3em";
    h.style.marginTop = "0.5em";
  });

  body.querySelectorAll<HTMLElement>("p").forEach((p) => {
    p.style.fontFamily = "'Times New Roman', Times, serif";
    p.style.fontSize = "12pt";
    p.style.lineHeight = "1.6";
    p.style.marginBottom = "0.5em";
  });

  const applyListStyles = (
    list: HTMLElement,
    depth: number,
    isOrdered: boolean,
  ) => {
    list.style.fontFamily = "'Times New Roman', Times, serif";
    list.style.fontSize = "12pt";
    list.style.paddingLeft = `${1.5 + depth * 1}em`;
    list.style.marginBottom = "0.5em";

    if (isOrdered) {
      const orderedTypes: ("decimal" | "lower-alpha" | "lower-roman")[] = [
        "decimal",
        "lower-alpha",
        "lower-roman",
      ];
      list.style.listStyleType = orderedTypes[depth % 3];
    } else {
      const bulletTypes = ["disc", "circle", "square"];
      list.style.listStyleType = bulletTypes[depth % 3];
    }

    list.querySelectorAll<HTMLElement>(":scope > li").forEach((li) => {
      li.style.fontFamily = "'Times New Roman', Times, serif";
      li.style.fontSize = "12pt";
      li.style.lineHeight = "1.6";
      li.style.marginBottom = "0.25em";

      li.querySelectorAll<HTMLElement>(":scope > ol").forEach((nested) =>
        applyListStyles(nested, depth + 1, true),
      );
      li.querySelectorAll<HTMLElement>(":scope > ul").forEach((nested) =>
        applyListStyles(nested, depth + 1, false),
      );
    });
  };

  body.querySelectorAll<HTMLElement>("body > ol, body > div > ol").forEach((ol) => {
    applyListStyles(ol, 0, true);
  });
  body.querySelectorAll<HTMLElement>("body > ul, body > div > ul").forEach((ul) => {
    applyListStyles(ul, 0, false);
  });

  body.querySelectorAll<HTMLElement>("blockquote").forEach((bq) => {
    bq.style.fontFamily = "'Times New Roman', Times, serif";
    bq.style.fontSize = "12pt";
    bq.style.fontStyle = "italic";
    bq.style.borderLeft = "3px solid #ccc";
    bq.style.paddingLeft = "1em";
    bq.style.color = "#555";
  });

  return body.innerHTML;
}
