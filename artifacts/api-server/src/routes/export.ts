import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, booksTable, chaptersTable } from "@workspace/db";

const router: IRouter = Router();

async function getBookWithChapters(bookId: number) {
  const book = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, bookId))
    .then((r) => r[0]);

  if (!book) return null;

  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId))
    .orderBy(asc(chaptersTable.sortOrder));

  return { ...book, chapters };
}

function buildHtmlBook(book: { title: string; author: string | null; description: string | null }, chapters: { title: string; type: string; content: string }[]): string {
  const toc = chapters
    .map((ch, i) => {
      const level = ch.type === "chapter" ? 1 : ch.type === "subchapter" ? 2 : 3;
      const indent = level === 1 ? "" : level === 2 ? "margin-left:20px;" : "margin-left:40px;";
      return `<li style="${indent}margin:4px 0"><a href="#ch-${i}" style="color:#2d3748;text-decoration:none;">${ch.title}</a></li>`;
    })
    .join("\n");

  const chaptersHtml = chapters
    .map((ch, i) => {
      const tag = ch.type === "chapter" ? "h2" : ch.type === "subchapter" ? "h3" : "h4";
      const content = ch.content
        .split("\n")
        .map((line) => `<p style="margin:0 0 0.8em 0;line-height:1.8;">${line}</p>`)
        .filter((p) => p !== '<p style="margin:0 0 0.8em 0;line-height:1.8;"></p>')
        .join("\n");
      return `<div id="ch-${i}" style="page-break-before:${i > 0 ? "always" : "auto"};padding-top:2em;">
        <${tag} style="font-family:Georgia,serif;color:#1a202c;margin:0 0 1em 0;">${ch.title}</${tag}>
        ${content}
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${book.title}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #2d3748; max-width: 680px; margin: 0 auto; padding: 40px 32px; background: #fff; }
    h1 { font-size: 2.2em; color: #1a202c; margin: 0 0 0.3em 0; }
    h2 { font-size: 1.6em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; }
    h3 { font-size: 1.3em; }
    h4 { font-size: 1.1em; }
    p { line-height: 1.8; margin: 0 0 0.8em 0; }
    @media print { body { padding: 20px; } }
    @page { margin: 2cm; }
  </style>
</head>
<body>
  <div style="text-align:center;padding:80px 0 60px;border-bottom:2px solid #e2e8f0;margin-bottom:60px;">
    <h1>${book.title}</h1>
    ${book.author ? `<p style="font-size:1.2em;color:#718096;margin-top:0.5em;">by ${book.author}</p>` : ""}
    ${book.description ? `<p style="font-size:0.95em;color:#a0aec0;margin-top:1em;font-style:italic;">${book.description}</p>` : ""}
  </div>

  ${chapters.length > 1 ? `<div style="margin-bottom:60px;">
    <h2 style="font-size:1.4em;margin-bottom:1em;">Table of Contents</h2>
    <ol style="list-style:none;padding:0;margin:0;">${toc}</ol>
  </div>` : ""}

  ${chaptersHtml}
</body>
</html>`;
}

router.get("/export/:bookId/pdf", async (req, res): Promise<void> => {
  const bookId = parseInt(req.params.bookId as string, 10);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid book ID" });
    return;
  }

  const book = await getBookWithChapters(bookId);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 72, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);

      const margin = 72;
      const pageWidth = doc.page.width - margin * 2;

      // Title page
      doc.moveDown(8);
      doc.font("Times-Bold").fontSize(28).text(book.title, { align: "center", width: pageWidth });
      if (book.author) {
        doc.moveDown(1);
        doc.font("Times-Roman").fontSize(16).fillColor("#555555").text(`by ${book.author}`, { align: "center" });
      }
      if (book.description) {
        doc.moveDown(2);
        doc.font("Times-Italic").fontSize(12).fillColor("#888888").text(book.description, { align: "center", width: pageWidth });
      }

      // Table of contents
      if (book.chapters.length > 1) {
        doc.addPage();
        doc.fillColor("#000000").font("Times-Bold").fontSize(20).text("Table of Contents", { align: "center" });
        doc.moveDown(1.5);
        book.chapters.forEach((ch, i) => {
          const indent = ch.type === "chapter" ? 0 : ch.type === "subchapter" ? 20 : 40;
          const fontSize = ch.type === "chapter" ? 13 : 11;
          doc.font(ch.type === "chapter" ? "Times-Bold" : "Times-Roman")
            .fontSize(fontSize)
            .fillColor("#333333")
            .text(`${i + 1}. ${ch.title}`, margin + indent, undefined, { width: pageWidth - indent });
          doc.moveDown(0.4);
        });
      }

      // Chapters
      book.chapters.forEach((ch, i) => {
        doc.addPage();

        const headingSize = ch.type === "chapter" ? 22 : ch.type === "subchapter" ? 18 : 15;
        doc.font("Times-Bold").fontSize(headingSize).fillColor("#1a202c").text(ch.title, { width: pageWidth });
        doc.moveDown(1.2);

        const paragraphs = ch.content.split("\n").filter((p) => p.trim());
        paragraphs.forEach((para) => {
          doc.font("Times-Roman").fontSize(12).fillColor("#2d3748")
            .text(para, { width: pageWidth, lineGap: 4, paragraphGap: 8 });
        });

        if (!ch.content.trim()) {
          doc.font("Times-Italic").fontSize(12).fillColor("#999999").text("(No content)");
        }
      });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const safeTitle = book.title.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    req.log.error({ err }, "PDF export error");
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

router.get("/export/:bookId/docx", async (req, res): Promise<void> => {
  const bookId = parseInt(req.params.bookId as string, 10);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid book ID" });
    return;
  }

  const book = await getBookWithChapters(bookId);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import("docx");

    const children: InstanceType<typeof Paragraph>[] = [];

    children.push(
      new Paragraph({
        text: book.title,
        heading: HeadingLevel.TITLE,
      }),
    );

    if (book.author) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `by ${book.author}`, italics: true, size: 28 })],
        }),
      );
    }

    if (book.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: book.description, italics: true, color: "666666" })],
        }),
      );
    }

    for (let i = 0; i < book.chapters.length; i++) {
      const ch = book.chapters[i];

      if (i > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }

      const heading =
        ch.type === "chapter"
          ? HeadingLevel.HEADING_1
          : ch.type === "subchapter"
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;

      children.push(new Paragraph({ text: ch.title, heading }));

      const paragraphs = ch.content.split("\n").filter((l) => l.trim());
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 24 })],
            spacing: { after: 200 },
          }),
        );
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const safeTitle = book.title.replace(/[^a-z0-9]/gi, "_");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.docx"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "DOCX export error");
    res.status(500).json({ error: "Failed to generate Word document." });
  }
});

router.get("/export/:bookId/epub", async (req, res): Promise<void> => {
  const bookId = parseInt(req.params.bookId as string, 10);
  if (isNaN(bookId)) {
    res.status(400).json({ error: "Invalid book ID" });
    return;
  }

  const book = await getBookWithChapters(bookId);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  try {
    const Epub = (await import("epub-gen")).default;

    const epubChapters = book.chapters.map((ch) => ({
      title: ch.title,
      data: ch.content
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `<p>${l}</p>`)
        .join(""),
    }));

    const options = {
      title: book.title,
      author: book.author ?? "Unknown Author",
      cover: undefined as string | undefined,
      content: epubChapters,
    };

    const epub = new Epub(options, "/tmp/temp.epub");
    await epub.promise;

    const fs = await import("fs");
    const epubBuffer = fs.readFileSync("/tmp/temp.epub");

    const safeTitle = book.title.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.epub"`);
    res.send(epubBuffer);
  } catch (err) {
    req.log.error({ err }, "EPUB export error");
    res.status(500).json({ error: "Failed to generate EPUB." });
  }
});

export default router;
