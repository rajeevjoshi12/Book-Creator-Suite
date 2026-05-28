import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetBook,
  getGetBookQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ExportModal } from "@/components/export-modal";
import { ArrowLeft, Download, Edit3, BookOpen, Loader2, Menu, X } from "lucide-react";

export default function ReaderPage() {
  const { bookId: bookIdStr } = useParams<{ bookId: string }>();
  const bookId = parseInt(bookIdStr ?? "0", 10);
  const [, setLocation] = useLocation();
  const [exportOpen, setExportOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  const { data: book, isLoading } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) },
  });

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

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Reader header */}
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
        {/* Table of contents sidebar */}
        {tocOpen && (
          <aside className="w-64 shrink-0 sticky top-[53px] h-[calc(100vh-53px)] overflow-y-auto border-r border-border bg-card/50 p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Contents
            </p>
            <nav className="space-y-1">
              {chapters.map((ch, i) => (
                <a
                  key={ch.id}
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
              ))}
            </nav>
          </aside>
        )}

        {/* Book content */}
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
                <span>
                  {Math.max(1, Math.ceil(chapters.reduce((acc, c) => acc + c.content.length, 0) / 1800))} pages
                </span>
              </div>
            </div>

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
                {chapters.map((ch, i) => {
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
                      >
                        {ch.type === "chapter" && (
                          <span className="text-muted-foreground font-normal text-sm block mb-1 font-sans">
                            Chapter {chapters.filter((c, ci) => c.type === "chapter" && ci <= i).length}
                          </span>
                        )}
                        {ch.title}
                      </Tag>
                      <div className="prose prose-gray max-w-none">
                        {ch.content.split("\n").filter((l) => l.trim()).map((para, pi) => (
                          <p
                            key={pi}
                            className="text-foreground leading-8 mb-5 font-serif text-[1.05rem]"
                          >
                            {para}
                          </p>
                        ))}
                        {!ch.content.trim() && (
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
              <p className="text-xs text-muted-foreground">
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
