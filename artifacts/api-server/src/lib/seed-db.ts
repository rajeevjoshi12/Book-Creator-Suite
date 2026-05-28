import { db, booksTable, chaptersTable, pagesTable } from "@workspace/db";

export async function seedIfEmpty() {
  const existing = await db.select().from(booksTable).limit(1);
  if (existing.length > 0) return;

  const [book] = await db
    .insert(booksTable)
    .values({
      title: "The Art of Deep Work",
      author: "Sample Author",
      description: "A guide to focused, distraction-free productivity in a noisy world.",
      coverColor: "#2d4a7a",
    })
    .returning();

  const chaptersData = [
    {
      title: "Introduction: Why Deep Work Matters",
      type: "chapter" as const,
      content:
        "In the age of constant connectivity, the ability to focus without distraction has become increasingly rare—and increasingly valuable.\n\nDeep work is the ability to focus without distraction on a cognitively demanding task. It is a skill that allows you to quickly master complicated information and produce better results in less time.",
      sortOrder: 0,
    },
    {
      title: "The Four Philosophies of Deep Work",
      type: "chapter" as const,
      content:
        "Not all deep work looks the same. Different people, with different constraints and goals, need different strategies.\n\nThe Monastic Philosophy maximises deep efforts by eliminating shallow obligations. The Bimodal Philosophy divides time between deep and open-ended pursuits. The Rhythmic Philosophy transforms sessions into regular habits. The Journalistic Philosophy fits deep work wherever possible.",
      sortOrder: 1,
    },
    {
      title: "Building a Deep Work Routine",
      type: "subchapter" as const,
      content:
        "Creating a sustainable routine requires rituals that minimise friction. Choose a consistent location, set a fixed start time, and establish rules about internet use during deep sessions.",
      sortOrder: 2,
    },
    {
      title: "Embracing Boredom",
      type: "chapter" as const,
      content:
        "One of the most important practices for deep work is training your ability to resist distraction even when you are not working. By deliberately embracing boredom you strengthen the mental muscles required for sustained concentration.",
      sortOrder: 3,
    },
  ];

  const insertedChapters = await db
    .insert(chaptersTable)
    .values(chaptersData.map((ch) => ({ ...ch, bookId: book.id })))
    .returning();

  await db.insert(pagesTable).values(
    insertedChapters.map((ch) => ({
      bookId: book.id,
      chapterId: ch.id,
      content: ch.content,
      sortOrder: 0,
    })),
  );
}
