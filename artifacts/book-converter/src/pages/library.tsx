import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListBooks,
  useGetLibraryStats,
  useDeleteBook,
  getListBooksQueryKey,
  getGetLibraryStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ExportModal } from "@/components/export-modal";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Trash2, Edit3, Download, Library } from "lucide-react";
import { format } from "date-fns";

const COVER_COLORS = [
  "#2d4a6e", "#4a2d6e", "#2d6e4a", "#6e4a2d", "#6e2d4a",
  "#1a5c6b", "#5c1a2d", "#3d5c1a", "#1a3d5c", "#5c3d1a",
];

function getCoverColor(book: { coverColor?: string | null; id: number }) {
  if (book.coverColor) return book.coverColor;
  return COVER_COLORS[book.id % COVER_COLORS.length];
}

export default function LibraryPage() {
  const [, setLocation] = useLocation();
  const [exportBookId, setExportBookId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: books = [], isLoading: booksLoading } = useListBooks();
  const { data: stats } = useGetLibraryStats();
  const deleteBook = useDeleteBook();

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deleteBook.mutate(
      { bookId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLibraryStatsQueryKey() });
          toast({ title: "Book deleted" });
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Library className="w-6 h-6 text-primary" />
            <span className="font-serif text-xl font-medium">BookForge</span>
          </div>
          <Button
            data-testid="button-new-book"
            onClick={() => setLocation("/editor/new")}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Book
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Stats */}
        {stats && (
          <div
            data-testid="stats-summary"
            className="grid grid-cols-3 gap-4 mb-10"
          >
            {[
              { label: "Books", value: stats.totalBooks },
              { label: "Chapters", value: stats.totalChapters },
              { label: "Pages", value: stats.totalPages },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-card border border-border rounded-lg px-6 py-5 text-center"
              >
                <p className="font-serif text-3xl font-medium text-foreground">
                  {s.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Section title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-medium">Your Library</h1>
          <span className="text-sm text-muted-foreground">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        </div>

        {/* Loading */}
        {booksLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-lg h-56 mb-3" />
                <div className="bg-muted rounded h-4 w-3/4 mb-2" />
                <div className="bg-muted rounded h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!booksLoading && books.length === 0 && (
          <div
            data-testid="empty-library"
            className="text-center py-24 border border-dashed border-border rounded-xl"
          >
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-serif text-xl mb-2">No books yet</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Paste text from an LLM, upload a PDF, or import a Word doc to create your first book.
            </p>
            <Button onClick={() => setLocation("/editor/new")} className="gap-2">
              <Plus className="w-4 h-4" /> Create your first book
            </Button>
          </div>
        )}

        {/* Book grid */}
        {!booksLoading && books.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((book) => {
              const color = getCoverColor(book);
              return (
                <div
                  key={book.id}
                  data-testid={`card-book-${book.id}`}
                  className="group relative"
                >
                  {/* Book cover */}
                  <div
                    className="relative rounded-lg overflow-hidden shadow-md cursor-pointer mb-3 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl"
                    style={{ backgroundColor: color, aspectRatio: "3/4" }}
                    onClick={() => setLocation(`/editor/${book.id}`)}
                  >
                    {/* Spine effect */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-3 opacity-20"
                      style={{ background: "rgba(0,0,0,0.4)" }}
                    />
                    {/* Book text */}
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-white font-serif font-medium text-base leading-tight line-clamp-3">
                          {book.title}
                        </p>
                        {book.author && (
                          <p className="text-white/70 text-xs">{book.author}</p>
                        )}
                      </div>
                    </div>
                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        data-testid={`button-edit-${book.id}`}
                        size="sm"
                        variant="secondary"
                        className="gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/editor/${book.id}`);
                        }}
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </Button>
                      <Button
                        data-testid={`button-export-${book.id}`}
                        size="sm"
                        variant="secondary"
                        className="gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExportBookId(book.id);
                        }}
                      >
                        <Download className="w-3 h-3" /> Export
                      </Button>
                    </div>
                  </div>

                  {/* Book meta */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p
                        className="font-medium text-sm text-foreground leading-tight truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setLocation(`/editor/${book.id}`)}
                        data-testid={`text-title-${book.id}`}
                      >
                        {book.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {book.chapterCount} {book.chapterCount === 1 ? "chapter" : "chapters"} &middot;{" "}
                        {book.pageCount} {book.pageCount === 1 ? "page" : "pages"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(book.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      data-testid={`button-delete-${book.id}`}
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDelete(book.id, book.title)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {exportBookId !== null && (
        <ExportModal
          bookId={exportBookId}
          open={exportBookId !== null}
          onOpenChange={(open) => !open && setExportBookId(null)}
        />
      )}
    </div>
  );
}
