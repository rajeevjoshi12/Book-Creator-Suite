import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
} from "@workspace/api-client-react";
import { plainTextToHtml } from "@/lib/html-utils";
import { Button } from "@/components/ui/button";
import { ExportModal } from "@/components/export-modal";
import {
  ArrowLeft,
  Download,
  Edit3,
  BookOpen,
  Loader2,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

const BOOK_FONT: React.CSSProperties = {
  fontFamily: "'Times New Roman', Times, serif",
  fontSize: "12pt",
};

export default function ReaderPage() {
  const { bookId: bookIdStr } = useParams<{ bookId: string }>();
  const bookId = parseInt(bookIdStr ?? "0", 10);
  const [, setLocation] = useLocation();
  const [exportOpen, setExportOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: book, isLoading, isFetching } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Book not found</p>
          <Button onClick={() => setLocation("/")}>Back to library</Button>
        </div>
      </div>
    );
  }

  const chapters = book.chapters ?? [];

  let globalPageNum = 0;
  const chaptersWithPageNums = chapters.map((ch) => ({
    ...ch,
    pages: (ch.pages ?? []).map((pg) => ({
      ...pg,
      pageNum: ++globalPageNum,
    })),
  }));

  const chapterIndex = chaptersWithPageNums.filter((c) => c.type === "chapter");

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <p className="font-serif text-sm font-medium truncate">{book.title}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Refresh index"
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="button-toc"
              onClick={() => setTocOpen(!tocOpen)}
            >
              {tocOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="button-edit"
              onClick={() => setLocation(`/editor/${bookId}`)}
            >
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid="button-export"
              onClick={() => setExportOpen(true)}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {tocOpen && (
          <aside className="w-64 shrink-0 sticky top-[53px] h-[calc(100vh-53px)] overflow-y-auto border-r border-border bg-card/50 p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Contents
            </p>
            <nav className="space-y-1">
              {chaptersWithPageNums.map((ch, i) => (
                <div key={ch.id}>
                  <a
                    href={`#ch-${ch.id}`}
                    data-testid={`toc-item-${ch.id}`}
                    className={`block text-sm py-1 px-2 rounded hover:bg-accent transition-colors leading-snug ${
                      ch.type === "chapter"
                        ? "font-medium text-foreground"
                        : ch.type === "subchapter"
                          ? "text-muted-foreground pl-5"
                          : "text-muted-foreground pl-8 text-xs"
                    }`}
                    onClick={() => setTocOpen(false)}
                  >
                    {ch.type === "chapter" ? `${i + 1}. ` : ""}{ch.title}
                  </a>
                  {ch.pages && ch.pages.length > 0 && (
                    <div className="ml-4 space-y-0.5">
                      {ch.pages.map((pg) => (
                        <a
                          key={pg.id}
                          href={`#pg-${ch.id}-${pg.id}`}
                          className="block text-xs py-0.5 px-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors truncate"
                          onClick={() => setTocOpen(false)}
                        >
                          <span className="font-mono text-[10px] mr-1 opacity-60">p.{pg.pageNum}</span>
                          {pg.title || `Page ${pg.pageNum}`}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </aside>
        )}

        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-8 py-16">
            {/* Title page */}
            <div className="text-center mb-20 pb-16 border-b border-border">
              <h1 className="font-serif text-4xl font-medium text-foreground mb-4 leading-tight">
                {book.title}
              </h1>
              {book.author && (
                <p className="text-lg text-muted-foreground font-serif italic">by {book.author}</p>
              )}
              {book.description && (
                <p className="text-sm text-muted-foreground mt-4 max-w-sm mx-auto leading-relaxed">
                  {book.description}
                </p>
              )}
              <div className="flex items-center justify-center gap-4 mt-8 text-xs text-muted-foreground">
                <span>{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</span>
                <span>&middot;</span>
                <span>{book.pageCount ?? 0} pages</span>
              </div>
            </div>

            {/* Inline hyperlink index */}
            {chaptersWithPageNums.length > 0 && (
              <section className="mb-20 pb-16 border-b border-border">
                <div className="flex items-center justify-between mb-6">
                  <h2
                    className="font-serif text-2xl font-medium"
                    style={BOOK_FONT}
                  >
                    Table of Contents
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={handleRefresh}
                    disabled={isFetching}
                    data-testid="button-refresh-index"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh Index
                  </Button>
                </div>
                <div className="space-y-1" style={BOOK_FONT}>
                  {chaptersWithPageNums.map((ch, i) => (
                    <div key={ch.id}>
                      <div className="flex items-baseline gap-2 py-1 group">
                        <a
                          href={`#ch-${ch.id}`}
                          className={`hover:text-primary transition-colors font-medium ${
                            ch.type === "chapter"
                              ? ""
                              : ch.type === "subchapter"
                                ? "pl-5 text-sm"
                                : "pl-10 text-xs"
                          }`}
                          style={BOOK_FONT}
                        >
                          {ch.type === "chapter"
                            ? `${chapterIndex.findIndex((c) => c.id === ch.id) + 1}. `
                            : ""}
                          {ch.title}
                        </a>
                        <span className="flex-1 border-b border-dotted border-border/60 mb-0.5" />
                        <span className="text-muted-foreground text-xs tabular-nums shrink-0" style={BOOK_FONT}>
                          {ch.type === "chapter" ? `Ch. ${chapterIndex.findIndex((c) => c.id === ch.id) + 1}` : ""}
                        </span>
                      </div>
                      {ch.pages && ch.pages.length > 0 && (
                        <div className="ml-6 space-y-0.5 mb-1">
                          {ch.pages.map((pg) => (
                            <div key={pg.id} className="flex items-baseline gap-2 py-0.5">
                              <a
                                href={`#pg-${ch.id}-${pg.id}`}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                style={BOOK_FONT}
                              >
                                {pg.title || `Page ${pg.pageNum}`}
                              </a>
                              <span className="flex-1 border-b border-dotted border-border/40 mb-0.5" />
                              <span className="text-muted-foreground text-xs tabular-nums shrink-0" style={BOOK_FONT}>
                                {pg.pageNum}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Chapters */}
            {chapters.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No chapters yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setLocation(`/editor/${bookId}`)}
                >
                  Open Editor
                </Button>
              </div>
            ) : (
              <div className="space-y-16">
                {chaptersWithPageNums.map((ch, i) => {
                  const Tag = ch.type === "chapter" ? "h2" : ch.type === "subchapter" ? "h3" : "h4";
                  return (
                    <section key={ch.id} id={`ch-${ch.id}`} data-testid={`reader-chapter-${ch.id}`}>
                      <Tag
                        className={`font-serif font-medium text-foreground mb-6 leading-tight ${
                          ch.type === "chapter"
                            ? "text-3xl border-b border-border pb-4"
                            : ch.type === "subchapter"
                              ? "text-xl"
                              : "text-lg"
                        }`}
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                      >
                        {ch.type === "chapter" && (
                          <span className="text-muted-foreground font-normal text-sm block mb-1 font-sans">
                            Chapter {chapters.filter((c, ci) => c.type === "chapter" && ci <= i).length}
                          </span>
                        )}
                        {ch.title}
                      </Tag>

                      <div className="prose prose-gray max-w-none leading-8 text-foreground" style={BOOK_FONT}>
                        {ch.content.trim() ? (
                          <div
                            className="[&>p]:mb-5 [&>p]:leading-8 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>blockquote]:border-l-4 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground"
                            style={BOOK_FONT}
                            dangerouslySetInnerHTML={{ __html: plainTextToHtml(ch.content) }}
                          />
                        ) : null}

                        {ch.pages && ch.pages.map((pg) => (
                          <div
                            key={pg.id}
                            id={`pg-${ch.id}-${pg.id}`}
                            className="mt-8 pt-6 border-t border-border/40"
                          >
                            <div className="flex items-center justify-between mb-3">
                              {pg.title && (
                                <h5
                                  className="font-semibold text-sm text-foreground"
                                  style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "12pt", fontWeight: "bold" }}
                                >
                                  {pg.title}
                                </h5>
                              )}
                              <span
                                className="text-xs text-muted-foreground tabular-nums ml-auto"
                                style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "10pt" }}
                              >
                                — {pg.pageNum} —
                              </span>
                            </div>
                            {pg.content.trim() ? (
                              <div
                                className="[&>p]:mb-5 [&>p]:leading-8 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>blockquote]:border-l-4 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-muted-foreground"
                                style={BOOK_FONT}
                                dangerouslySetInnerHTML={{ __html: plainTextToHtml(pg.content) }}
                              />
                            ) : null}
                          </div>
                        ))}

                        {!ch.content.trim() && (!ch.pages || ch.pages.every((p) => !p.content.trim())) && (
                          <p className="text-muted-foreground italic text-sm">
                            Chapter content is empty. Open the editor to add content.
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-24 pt-8 border-t border-border text-center">
              <p className="text-xs text-muted-foreground" style={BOOK_FONT}>
                {book.title}{book.author ? ` — ${book.author}` : ""}
              </p>
            </div>
          </div>
        </main>
      </div>

      <ExportModal bookId={bookId} open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
