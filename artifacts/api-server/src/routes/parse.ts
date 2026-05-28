import { Router, type IRouter } from "express";
import multer from "multer";
import { ParseTextBody } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function parseTextIntoChapters(text: string): {
  suggestedTitle: string;
  chapters: { title: string; type: "chapter" | "subchapter" | "section"; content: string }[];
} {
  const lines = text.split("\n");
  const chapters: { title: string; type: "chapter" | "subchapter" | "section"; content: string }[] = [];
  let suggestedTitle = "Untitled Book";
  let currentChapterTitle = "";
  let currentContent: string[] = [];
  let foundTitle = false;

  const isChapterHeader = (line: string) =>
    /^#{1,2}\s/.test(line) ||
    /^chapter\s+\d+/i.test(line.trim()) ||
    /^chapter\s*:/i.test(line.trim()) ||
    /^\d+\.\s+[A-Z]/.test(line.trim());

  const isSubchapterHeader = (line: string) =>
    /^#{3,4}\s/.test(line) ||
    /^\d+\.\d+\s/.test(line.trim());

  const cleanHeader = (line: string) =>
    line.replace(/^#{1,6}\s+/, "").replace(/^\d+\.\d*\s+/, "").trim();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!foundTitle && trimmed.length > 0 && !isChapterHeader(line)) {
      if (/^#{1}\s/.test(line)) {
        suggestedTitle = cleanHeader(line);
        foundTitle = true;
        continue;
      }
      if (!currentChapterTitle && trimmed.length > 3 && trimmed.length < 100) {
        suggestedTitle = trimmed;
        foundTitle = true;
        continue;
      }
    }

    if (isChapterHeader(line)) {
      if (currentChapterTitle) {
        chapters.push({
          title: currentChapterTitle,
          type: "chapter",
          content: currentContent.join("\n").trim(),
        });
      } else if (currentContent.length > 0) {
        chapters.push({
          title: suggestedTitle || "Introduction",
          type: "chapter",
          content: currentContent.join("\n").trim(),
        });
      }
      currentChapterTitle = cleanHeader(line);
      currentContent = [];
    } else if (isSubchapterHeader(line)) {
      if (currentContent.length > 0 && currentChapterTitle) {
        chapters.push({
          title: currentChapterTitle,
          type: "chapter",
          content: currentContent.join("\n").trim(),
        });
        currentContent = [];
      }
      const newTitle = cleanHeader(line);
      if (newTitle) {
        chapters.push({
          title: newTitle,
          type: "subchapter",
          content: "",
        });
        currentChapterTitle = "";
      }
    } else {
      currentContent.push(line);
    }
  }

  if (currentChapterTitle || currentContent.length > 0) {
    chapters.push({
      title: currentChapterTitle || "Main Content",
      type: "chapter",
      content: currentContent.join("\n").trim(),
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      title: "Chapter 1",
      type: "chapter",
      content: text.trim(),
    });
  }

  return { suggestedTitle, chapters };
}

router.post("/parse/text", async (req, res): Promise<void> => {
  const parsed = ParseTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = parseTextIntoChapters(parsed.data.text);
  res.json(result);
});

router.post("/parse/pdf", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(req.file.buffer);
    const result = parseTextIntoChapters(data.text);
    const suggestedTitle = result.suggestedTitle !== "Untitled Book"
      ? result.suggestedTitle
      : req.file.originalname.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
    res.json({ ...result, suggestedTitle });
  } catch (err) {
    req.log.error({ err }, "PDF parse error");
    res.status(422).json({ error: "Failed to parse PDF. Ensure it contains extractable text." });
  }
});

router.post("/parse/docx", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const mammoth = (await import("mammoth")).default;
    const { value: html } = await mammoth.convertToHtml({ buffer: req.file.buffer });
    const text = html
      .replace(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/gi, "\n## $1\n")
      .replace(/<h[3-6][^>]*>(.*?)<\/h[3-6]>/gi, "\n### $1\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ");

    const result = parseTextIntoChapters(text);
    const suggestedTitle = result.suggestedTitle !== "Untitled Book"
      ? result.suggestedTitle
      : req.file.originalname.replace(/\.docx?$/i, "").replace(/[-_]/g, " ");
    res.json({ ...result, suggestedTitle });
  } catch (err) {
    req.log.error({ err }, "DOCX parse error");
    res.status(422).json({ error: "Failed to parse Word document." });
  }
});

export default router;
