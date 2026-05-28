import { Router, type IRouter } from "express";
import { eq, desc, sql, count } from "drizzle-orm";
import { db, booksTable, chaptersTable } from "@workspace/db";
import {
  CreateBookBody,
  UpdateBookBody,
  UpdateBookParams,
  GetBookParams,
  DeleteBookParams,
  ListChaptersParams,
  AppendTextToBookBody,
  AppendTextToBookParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function estimatePageCount(chapters: { content: string }[]): number {
  const totalChars = chapters.reduce((acc, c) => acc + c.content.length, 0);
  return Math.max(1, Math.ceil(totalChars / 1800));
}

async function buildBookWithCounts(bookId: number) {
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
    .orderBy(chaptersTable.sortOrder);

  return {
    ...book,
    chapterCount: chapters.length,
    pageCount: estimatePageCount(chapters),
    chapters,
  };
}

router.get("/books", async (_req, res): Promise<void> => {
  const books = await db
    .select()
    .from(booksTable)
    .orderBy(desc(booksTable.createdAt));

  const booksWithCounts = await Promise.all(
    books.map(async (book) => {
      const chapters = await db
        .select()
        .from(chaptersTable)
        .where(eq(chaptersTable.bookId, book.id));
      return {
        ...book,
        chapterCount: chapters.length,
        pageCount: estimatePageCount(chapters),
      };
    }),
  );

  res.json(booksWithCounts);
});

router.get("/books/stats", async (_req, res): Promise<void> => {
  const totalBooksResult = await db
    .select({ count: count() })
    .from(booksTable);
  const totalChaptersResult = await db
    .select({ count: count() })
    .from(chaptersTable);
  const totalBooks = totalBooksResult[0]?.count ?? 0;
  const totalChapters = totalChaptersResult[0]?.count ?? 0;

  const allChapters = await db.select().from(chaptersTable);
  const totalPages = estimatePageCount(allChapters);

  const recentBooksRaw = await db
    .select()
    .from(booksTable)
    .orderBy(desc(booksTable.createdAt))
    .limit(5);

  const recentBooks = await Promise.all(
    recentBooksRaw.map(async (book) => {
      const chapters = await db
        .select()
        .from(chaptersTable)
        .where(eq(chaptersTable.bookId, book.id));
      return {
        ...book,
        chapterCount: chapters.length,
        pageCount: estimatePageCount(chapters),
      };
    }),
  );

  res.json({ totalBooks, totalChapters, totalPages, recentBooks });
});

router.post("/books", async (req, res): Promise<void> => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [book] = await db.insert(booksTable).values(parsed.data).returning();

  res.status(201).json({
    ...book,
    chapterCount: 0,
    pageCount: 0,
  });
});

router.get("/books/:bookId", async (req, res): Promise<void> => {
  const params = GetBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await buildBookWithCounts(params.data.bookId);
  if (!result) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json(result);
});

router.patch("/books/:bookId", async (req, res): Promise<void> => {
  const params = UpdateBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(booksTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(booksTable.id, params.data.bookId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, updated.id));

  res.json({
    ...updated,
    chapterCount: chapters.length,
    pageCount: estimatePageCount(chapters),
  });
});

router.delete("/books/:bookId", async (req, res): Promise<void> => {
  const params = DeleteBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(booksTable)
    .where(eq(booksTable.id, params.data.bookId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/books/:bookId/append-text", async (req, res): Promise<void> => {
  const params = AppendTextToBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AppendTextToBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const book = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, params.data.bookId))
    .then((r) => r[0]);

  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const existingChapters = await db
    .select({ sortOrder: chaptersTable.sortOrder })
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, params.data.bookId))
    .orderBy(desc(chaptersTable.sortOrder))
    .limit(1);

  const nextSortOrder = (existingChapters[0]?.sortOrder ?? -1) + 1;
  const chapterTitle = parsed.data.chapterTitle ?? `Appended Content`;

  await db.insert(chaptersTable).values({
    bookId: params.data.bookId,
    title: chapterTitle,
    type: "chapter",
    content: parsed.data.text,
    sortOrder: nextSortOrder,
  });

  await db
    .update(booksTable)
    .set({ updatedAt: new Date() })
    .where(eq(booksTable.id, params.data.bookId));

  const result = await buildBookWithCounts(params.data.bookId);
  res.json(result);
});

export default router;
