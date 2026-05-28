import { Router, type IRouter } from "express";
import { eq, asc, desc, and } from "drizzle-orm";
import { db, pagesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router({ mergeParams: true });

const PageParams = z.object({
  bookId: z.coerce.number().int().positive(),
  chapterId: z.coerce.number().int().positive(),
});

const PageIdParams = PageParams.extend({
  pageId: z.coerce.number().int().positive(),
});

const PageInput = z.object({
  title: z.string(),
  content: z.string(),
  sortOrder: z.number().int().optional(),
});

const PageUpdate = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const PageReorder = z.object({
  orderedIds: z.array(z.number().int().positive()),
});

router.get("/", async (req, res): Promise<void> => {
  const params = PageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const pages = await db
    .select()
    .from(pagesTable)
    .where(
      and(
        eq(pagesTable.bookId, params.data.bookId),
        eq(pagesTable.chapterId, params.data.chapterId),
      ),
    )
    .orderBy(asc(pagesTable.sortOrder));

  res.json(pages);
});

router.post("/", async (req, res): Promise<void> => {
  const params = PageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = PageInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder == null) {
    const existing = await db
      .select({ sortOrder: pagesTable.sortOrder })
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.bookId, params.data.bookId),
          eq(pagesTable.chapterId, params.data.chapterId),
        ),
      )
      .orderBy(desc(pagesTable.sortOrder))
      .limit(1);
    sortOrder = (existing[0]?.sortOrder ?? -1) + 1;
  }

  const [page] = await db
    .insert(pagesTable)
    .values({
      bookId: params.data.bookId,
      chapterId: params.data.chapterId,
      title: parsed.data.title,
      content: parsed.data.content,
      sortOrder,
    })
    .returning();

  res.status(201).json(page);
});

router.patch("/reorder", async (req, res): Promise<void> => {
  const params = PageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = PageReorder.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await Promise.all(
    parsed.data.orderedIds.map((id: number, index: number) =>
      db
        .update(pagesTable)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(
          and(
            eq(pagesTable.id, id),
            eq(pagesTable.chapterId, params.data.chapterId),
            eq(pagesTable.bookId, params.data.bookId),
          ),
        ),
    ),
  );

  const updated = await db
    .select()
    .from(pagesTable)
    .where(
      and(
        eq(pagesTable.bookId, params.data.bookId),
        eq(pagesTable.chapterId, params.data.chapterId),
      ),
    )
    .orderBy(asc(pagesTable.sortOrder));

  res.json(updated);
});

router.patch("/:pageId", async (req, res): Promise<void> => {
  const params = PageIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = PageUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(pagesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(pagesTable.id, params.data.pageId),
        eq(pagesTable.chapterId, params.data.chapterId),
        eq(pagesTable.bookId, params.data.bookId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(updated);
});

router.delete("/:pageId", async (req, res): Promise<void> => {
  const params = PageIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(pagesTable)
    .where(
      and(
        eq(pagesTable.id, params.data.pageId),
        eq(pagesTable.chapterId, params.data.chapterId),
        eq(pagesTable.bookId, params.data.bookId),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
