import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, chaptersTable } from "@workspace/db";
import {
  CreateChapterBody,
  CreateChapterParams,
  UpdateChapterBody,
  UpdateChapterParams,
  DeleteChapterParams,
  ListChaptersParams,
  ReorderChaptersBody,
  ReorderChaptersParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/books/:bookId/chapters", async (req, res): Promise<void> => {
  const params = ListChaptersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, params.data.bookId))
    .orderBy(asc(chaptersTable.sortOrder));

  res.json(chapters);
});

router.post("/books/:bookId/chapters", async (req, res): Promise<void> => {
  const params = CreateChapterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateChapterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder == null) {
    const existing = await db
      .select({ sortOrder: chaptersTable.sortOrder })
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, params.data.bookId))
      .orderBy(desc(chaptersTable.sortOrder))
      .limit(1);
    sortOrder = (existing[0]?.sortOrder ?? -1) + 1;
  }

  const [chapter] = await db
    .insert(chaptersTable)
    .values({
      bookId: params.data.bookId,
      title: parsed.data.title,
      type: parsed.data.type ?? "chapter",
      content: parsed.data.content,
      sortOrder,
    })
    .returning();

  res.status(201).json(chapter);
});

router.patch(
  "/books/:bookId/chapters/reorder",
  async (req, res): Promise<void> => {
    const params = ReorderChaptersParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = ReorderChaptersBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        db
          .update(chaptersTable)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(chaptersTable.id, id)),
      ),
    );

    const updated = await db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, params.data.bookId))
      .orderBy(asc(chaptersTable.sortOrder));

    res.json(updated);
  },
);

router.patch(
  "/books/:bookId/chapters/:chapterId",
  async (req, res): Promise<void> => {
    const params = UpdateChapterParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateChapterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [updated] = await db
      .update(chaptersTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(chaptersTable.id, params.data.chapterId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    res.json(updated);
  },
);

router.delete(
  "/books/:bookId/chapters/:chapterId",
  async (req, res): Promise<void> => {
    const params = DeleteChapterParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(chaptersTable)
      .where(eq(chaptersTable.id, params.data.chapterId))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Chapter not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
