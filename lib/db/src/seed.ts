import { db, booksTable, chaptersTable, pagesTable } from "./index";

async function seed() {
  const existing = await db.select().from(booksTable);
  if (existing.length > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }

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
        "In an age of constant connectivity, the ability to perform deep work — focused, undistracted effort on cognitively demanding tasks — has become both increasingly rare and increasingly valuable.\n\nThis book argues that cultivating a deep work habit is one of the most powerful things you can do for your career and intellectual life.",
      sortOrder: 0,
    },
    {
      title: "The Four Philosophies of Deep Work",
      type: "chapter" as const,
      content:
        "There is no single right way to integrate deep work into your schedule. Depending on your role and circumstances, different philosophies may suit you better.\n\nThe monastic philosophy eliminates all shallow obligations to maximise deep efforts. The bimodal philosophy divides time between deep and open-ended pursuits. The rhythmic philosophy builds daily habits. The journalistic philosophy fits deep work wherever possible.",
      sortOrder: 1,
    },
    {
      title: "Building a Deep Work Routine",
      type: "subchapter" as const,
      content:
        "Creating a sustainable deep work routine requires planning rituals that minimise the friction of starting and maintaining focus. Decide on a consistent location, set a fixed start time, and establish rules about internet use and communication during deep sessions.",
      sortOrder: 2,
    },
    {
      title: "Embracing Boredom",
      type: "chapter" as const,
      content:
        "One of the most important practices for deep work is training your ability to resist distraction even when you are not working. By deliberately embracing boredom — resisting the urge to fill every quiet moment with a screen — you strengthen the mental muscles required for sustained concentration.",
      sortOrder: 3,
    },
  ];

  const insertedChapters = await db
    .insert(chaptersTable)
    .values(chaptersData.map((ch) => ({ ...ch, bookId: book.id })))
    .returning();

  const pagesData = insertedChapters.flatMap((ch, i) => [
    {
      bookId: book.id,
      chapterId: ch.id,
      content: ch.content,
      sortOrder: 0,
    },
  ]);

  await db.insert(pagesTable).values(pagesData);

  console.log(
    `Seeded book "${book.title}" with ${insertedChapters.length} chapters and ${pagesData.length} pages.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
