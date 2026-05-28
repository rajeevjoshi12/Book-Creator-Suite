import { useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetBook,
  useUpdateBook,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useReorderChapters,
  useAppendTextToBook,
  useParseText,
  useListPages,
  useCreatePage,
  useUpdatePage,
  useDeletePage,
  useReorderPages,
  getGetBookQueryKey,
  getListBooksQueryKey,
  getGetLibraryStatsQueryKey,
  getListPagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportModal } from "@/components/export-modal";
import { RichTextEditor } from "@/components/rich-text-editor";
import { plainTextToHtml, htmlToPlainText } from "@/lib/html-utils";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Download,
  BookOpen,
  Eye,
  Save,
  Loader2,
  Upload,
  ChevronDown,
  FileText,
  LayoutList,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function apiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

interface SortableChapterProps {
  chapter: { id: number; title: string; type: string };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableChapter({ chapter, isActive, onSelect, onDelete }: SortableChapterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`chapter-item-${chapter.id}`}
      className={`group flex items-center gap-1 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-foreground"
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-50 shrink-0 cursor-grab active:cursor-grabbing p-0.5"
        onClick={(e) => e.stopPropagation()}
        data-testid={`drag-handle-${chapter.id}`}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {chapter.type !== "chapter" && (
            <span className={`text-[10px] font-mono opacity-60 ${chapter.type === "subchapter" ? "ml-2" : "ml-4"}`}>
              {chapter.type === "subchapter" ? "›" : "»"}
            </span>
          )}
          <p className="text-xs font-medium truncate leading-snug">{chapter.title}</p>
        </div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 shrink-0 p-0.5 hover:text-destructive transition-colors"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        data-testid={`button-delete-chapter-${chapter.id}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

interface SortablePageProps {
  page: { id: number; title: string; content: string; sortOrder: number };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortablePage({ page, isActive, onSelect, onDelete }: SortablePageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`page-item-${page.id}`}
      className={`group flex items-center gap-1 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
      }`}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-50 shrink-0 cursor-grab active:cursor-grabbing p-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <FileText className="w-3 h-3 shrink-0 opacity-60" />
      <p className="text-xs flex-1 truncate leading-snug ml-1">{page.title || "Untitled page"}</p>
      <button
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 shrink-0 p-0.5 hover:text-destructive transition-colors"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        data-testid={`button-delete-page-${page.id}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

type ChapterType = "chapter" | "subchapter" | "section";

export default function EditorPage() {
  const { bookId: bookIdStr } = useParams<{ bookId: string }>();
  const bookId = parseInt(bookIdStr ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"content" | "pages">("content");
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [pageTitle, setPageTitle] = useState<Record<number, string>>({});
  const [pageContent, setPageContent] = useState<Record<number, string>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorValue, setAuthorValue] = useState("");
  const [chapterContent, setChapterContent] = useState<Record<number, string>>({});
  const [chapterTitle, setChapterTitle] = useState<Record<number, string>>({});
  const [appendOpen, setAppendOpen] = useState(false);
  const [appendText, setAppendText] = useState("");
  const [appendChapterTitle, setAppendChapterTitle] = useState("");
  const appendFileRef = useRef<HTMLInputElement>(null);
  const [isAppendUploading, setIsAppendUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: book, isLoading } = useGetBook(bookId, {
    query: {
      enabled: !!bookId,
      queryKey: getGetBookQueryKey(bookId),
    },
  });

  const updateBook = useUpdateBook();
  const createChapter = useCreateChapter();
  const updateChapter = useUpdateChapter();
  const deleteChapter = useDeleteChapter();
  const reorderChapters = useReorderChapters();
  const appendTextMutation = useAppendTextToBook();
  const parseText = useParseText();

  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const deletePage = useDeletePage();
  const reorderPages = useReorderPages();

  const { data: pages } = useListPages(
    bookId,
    selectedChapterId ?? 0,
    { query: { enabled: !!selectedChapterId, queryKey: getListPagesQueryKey(bookId, selectedChapterId ?? 0) } },
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetBookQueryKey(bookId) });
    queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLibraryStatsQueryKey() });
  }, [queryClient, bookId]);

  const invalidatePages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListPagesQueryKey(bookId, selectedChapterId ?? 0) });
  }, [queryClient, bookId, selectedChapterId]);

  const selectedPage = pages?.find((p) => p.id === selectedPageId);
  const currentPageTitle = selectedPageId != null ? (pageTitle[selectedPageId] ?? selectedPage?.title ?? "") : "";
  const currentPageContent = selectedPageId != null ? (pageContent[selectedPageId] ?? selectedPage?.content ?? "") : "";

  const handleAddPage = () => {
    if (!selectedChapterId) return;
    createPage.mutate(
      { bookId, chapterId: selectedChapterId, data: { title: "New Page", content: "", sortOrder: pages?.length ?? 0 } },
      {
        onSuccess: (p) => { invalidatePages(); setSelectedPageId(p.id); },
        onError: () => toast({ title: "Failed to create page", variant: "destructive" }),
      },
    );
  };

  const handleSavePage = () => {
    if (!selectedPageId || !selectedChapterId) return;
    updatePage.mutate(
      { bookId, chapterId: selectedChapterId, pageId: selectedPageId, data: { title: currentPageTitle, content: currentPageContent } },
      {
        onSuccess: () => { invalidatePages(); toast({ title: "Page saved" }); },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  const handleDeletePage = (pageId: number) => {
    if (!selectedChapterId) return;
    if (!confirm("Delete this page?")) return;
    deletePage.mutate(
      { bookId, chapterId: selectedChapterId, pageId },
      {
        onSuccess: () => { if (selectedPageId === pageId) setSelectedPageId(null); invalidatePages(); },
      },
    );
  };

  const handlePageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pages || !selectedChapterId) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...pages];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    reorderPages.mutate(
      { bookId, chapterId: selectedChapterId, data: { orderedIds: newOrder.map((p) => p.id) } },
      { onSuccess: invalidatePages },
    );
  };

  const selectedChapter = book?.chapters?.find((c) => c.id === selectedChapterId);
  const currentContent = selectedChapterId != null
    ? (chapterContent[selectedChapterId] ?? selectedChapter?.content ?? "")
    : "";
  const currentChapterTitle = selectedChapterId != null
    ? (chapterTitle[selectedChapterId] ?? selectedChapter?.title ?? "")
    : "";

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !book?.chapters) return;

    const oldIndex = book.chapters.findIndex((c) => c.id === active.id);
    const newIndex = book.chapters.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...book.chapters];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    reorderChapters.mutate(
      { bookId, data: { orderedIds: newOrder.map((c) => c.id) } },
      { onSuccess: invalidate },
    );
  };

  const handleSaveChapter = () => {
    if (!selectedChapterId) return;
    updateChapter.mutate(
      {
        bookId,
        chapterId: selectedChapterId,
        data: {
          title: currentChapterTitle,
          content: currentContent,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Chapter saved" });
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  const handleDeleteChapter = (chapterId: number) => {
    if (!confirm("Delete this chapter?")) return;
    deleteChapter.mutate(
      { bookId, chapterId },
      {
        onSuccess: () => {
          if (selectedChapterId === chapterId) setSelectedChapterId(null);
          invalidate();
        },
      },
    );
  };

  const handleAddChapter = (type: ChapterType) => {
    const sortOrder = (book?.chapters?.length ?? 0);
    createChapter.mutate(
      {
        bookId,
        data: { title: type === "chapter" ? "New Chapter" : type === "subchapter" ? "New Section" : "New Part", type, content: "", sortOrder },
      },
      {
        onSuccess: (ch) => {
          invalidate();
          setSelectedChapterId(ch.id);
        },
      },
    );
  };

  const handleBookTitleSave = () => {
    if (!titleValue.trim()) return;
    updateBook.mutate(
      { bookId, data: { title: titleValue.trim() } },
      {
        onSuccess: () => { setEditingTitle(false); invalidate(); },
      },
    );
  };

  const handleBookAuthorSave = () => {
    updateBook.mutate(
      { bookId, data: { author: authorValue.trim() } },
      {
        onSuccess: () => { setEditingAuthor(false); invalidate(); },
      },
    );
  };

  const handleAppendText = () => {
    if (!appendText.trim()) return;
    appendTextMutation.mutate(
      { bookId, data: { text: appendText, chapterTitle: appendChapterTitle || undefined } },
      {
        onSuccess: () => {
          setAppendOpen(false);
          setAppendText("");
          setAppendChapterTitle("");
          invalidate();
          toast({ title: "Content appended" });
        },
      },
    );
  };

  const handleAppendFile = async (file: File, type: "pdf" | "docx") => {
    setIsAppendUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiUrl(`/parse/${type}`), { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const result = await res.json();
      const text = result.chapters.map((c: { title: string; content: string }) => `## ${c.title}\n\n${c.content}`).join("\n\n");
      setAppendText(text);
      toast({ title: "File parsed — review and append" });
    } catch {
      toast({ title: "Failed to parse file", variant: "destructive" });
    } finally {
      setIsAppendUploading(false);
    }
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="h-7 text-sm font-serif font-medium w-72"
                  onKeyDown={(e) => { if (e.key === "Enter") handleBookTitleSave(); if (e.key === "Escape") setEditingTitle(false); }}
                  autoFocus
                  data-testid="input-book-title"
                />
                <Button size="sm" className="h-7" onClick={handleBookTitleSave}>
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <button
                className="text-left"
                onClick={() => { setEditingTitle(true); setTitleValue(book.title); }}
                data-testid="button-edit-title"
              >
                <p className="font-serif font-medium text-sm truncate hover:text-primary transition-colors">
                  {book.title}
                </p>
                {editingAuthor ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={authorValue}
                      onChange={(e) => setAuthorValue(e.target.value)}
                      className="h-5 text-xs w-40"
                      onKeyDown={(e) => { if (e.key === "Enter") handleBookAuthorSave(); if (e.key === "Escape") setEditingAuthor(false); }}
                      autoFocus
                      data-testid="input-book-author"
                      placeholder="Author name"
                    />
                    <Button size="sm" className="h-5 px-1.5" onClick={handleBookAuthorSave}>
                      <Save className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditingAuthor(true); setAuthorValue(book.author ?? ""); }}
                  >
                    {book.author ?? "Add author"}
                  </p>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-reader"
              onClick={() => setLocation(`/reader/${bookId}`)}
              className="gap-1.5 h-8"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export"
              onClick={() => setExportOpen(true)}
              className="gap-1.5 h-8"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border bg-sidebar flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-border shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1">
                Chapters
              </span>
              <div className="flex gap-0.5">
                {(["chapter", "subchapter", "section"] as ChapterType[]).map((type) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title={`Add ${type}`}
                    data-testid={`button-add-${type}`}
                    onClick={() => handleAddChapter(type)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {(!book.chapters || book.chapters.length === 0) && (
              <div className="text-center py-8">
                <BookOpen className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No chapters yet</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs gap-1"
                  onClick={() => handleAddChapter("chapter")}
                >
                  <Plus className="w-3 h-3" /> Add chapter
                </Button>
              </div>
            )}

            {book.chapters && book.chapters.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={book.chapters.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {book.chapters.map((ch) => (
                    <SortableChapter
                      key={ch.id}
                      chapter={ch}
                      isActive={ch.id === selectedChapterId}
                      onSelect={() => {
                        setSelectedChapterId(ch.id);
                      }}
                      onDelete={() => handleDeleteChapter(ch.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="p-3 border-t border-border shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs h-8"
              data-testid="button-append"
              onClick={() => setAppendOpen(!appendOpen)}
            >
              <Upload className="w-3 h-3" />
              Append Content
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${appendOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </aside>

        {/* Append panel */}
        {appendOpen && (
          <div className="w-72 border-r border-border bg-card flex flex-col shrink-0 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm">Append Content</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Add more content to this book</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Chapter title (optional)</label>
                <Input
                  value={appendChapterTitle}
                  onChange={(e) => setAppendChapterTitle(e.target.value)}
                  placeholder="e.g. Appendix"
                  className="h-8 text-sm"
                  data-testid="input-append-title"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Paste text</label>
                <textarea
                  value={appendText}
                  onChange={(e) => setAppendText(e.target.value)}
                  placeholder="Paste content here..."
                  className="w-full h-40 p-3 rounded-md border border-border bg-background text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="input-append-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex flex-col items-center gap-1 p-3 rounded-md border border-dashed border-border hover:border-primary/50 text-center cursor-pointer transition-colors"
                  onClick={() => appendFileRef.current?.click()}
                  data-testid="button-append-pdf"
                >
                  {isAppendUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">Upload PDF</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1 p-3 rounded-md border border-dashed border-border hover:border-primary/50 text-center cursor-pointer transition-colors"
                  onClick={() => appendFileRef.current?.click()}
                  data-testid="button-append-docx"
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload DOCX</span>
                </button>
              </div>
              <input
                ref={appendFileRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const type = file.name.endsWith(".pdf") ? "pdf" : "docx";
                  handleAppendFile(file, type);
                  e.target.value = "";
                }}
              />
              <Button
                className="w-full gap-2"
                size="sm"
                disabled={!appendText.trim()}
                onClick={handleAppendText}
                data-testid="button-append-submit"
              >
                {appendTextMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Append to Book
              </Button>
            </div>
          </div>
        )}

        {/* Main editor */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {!selectedChapter ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">
                  {book.chapters && book.chapters.length > 0
                    ? "Select a chapter to edit"
                    : "Add a chapter to get started"}
                </p>
                {(!book.chapters || book.chapters.length === 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => handleAddChapter("chapter")}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Chapter
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chapter toolbar */}
              <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
                <input
                  className="flex-1 font-serif text-lg font-medium bg-transparent border-none outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
                  value={currentChapterTitle}
                  onChange={(e) =>
                    setChapterTitle((prev) => ({ ...prev, [selectedChapterId!]: e.target.value }))
                  }
                  placeholder="Chapter title"
                  data-testid="input-chapter-title"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="text-xs border border-border rounded px-2 py-1 bg-background"
                    value={selectedChapter.type}
                    data-testid="select-chapter-type"
                    onChange={(e) => {
                      updateChapter.mutate(
                        { bookId, chapterId: selectedChapter.id, data: { type: e.target.value as ChapterType } },
                        { onSuccess: invalidate },
                      );
                    }}
                  >
                    <option value="chapter">Chapter</option>
                    <option value="subchapter">Subchapter</option>
                    <option value="section">Section</option>
                  </select>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={activeView === "content" ? handleSaveChapter : handleSavePage}
                    disabled={updateChapter.isPending || updatePage.isPending}
                    data-testid="button-save-chapter"
                  >
                    {(updateChapter.isPending || updatePage.isPending) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              {/* View tabs */}
              <div className="flex items-center border-b border-border shrink-0 px-6">
                <button
                  className={`flex items-center gap-1.5 px-1 py-2 text-xs font-medium border-b-2 mr-4 transition-colors ${
                    activeView === "content"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveView("content")}
                  data-testid="tab-content"
                >
                  <LayoutList className="w-3 h-3" />
                  Content
                </button>
                <button
                  className={`flex items-center gap-1.5 px-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeView === "pages"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveView("pages")}
                  data-testid="tab-pages"
                >
                  <FileText className="w-3 h-3" />
                  Pages
                  {pages && pages.length > 0 && (
                    <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-mono">
                      {pages.length}
                    </span>
                  )}
                </button>
              </div>

              {activeView === "content" && (
                <div className="flex-1 overflow-hidden flex flex-col" data-testid="input-chapter-content">
                  <RichTextEditor
                    key={selectedChapterId}
                    content={plainTextToHtml(currentContent)}
                    onChange={(html) =>
                      setChapterContent((prev) => ({ ...prev, [selectedChapterId!]: htmlToPlainText(html) }))
                    }
                    placeholder="Start writing your chapter content here..."
                    className="flex-1 overflow-hidden"
                  />
                </div>
              )}

              {activeView === "pages" && (
                <div className="flex-1 overflow-hidden flex" data-testid="pages-panel">
                  {/* Pages list */}
                  <div className="w-52 border-r border-border flex flex-col shrink-0 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleAddPage}
                        data-testid="button-add-page"
                        title="Add page"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {(!pages || pages.length === 0) && (
                        <div className="text-center py-6">
                          <FileText className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No pages yet</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs gap-1"
                            onClick={handleAddPage}
                          >
                            <Plus className="w-3 h-3" /> Add page
                          </Button>
                        </div>
                      )}
                      {pages && pages.length > 0 && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handlePageDragEnd}
                        >
                          <SortableContext
                            items={pages.map((p) => p.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {pages.map((p) => (
                              <SortablePage
                                key={p.id}
                                page={p}
                                isActive={p.id === selectedPageId}
                                onSelect={() => setSelectedPageId(p.id)}
                                onDelete={() => handleDeletePage(p.id)}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  </div>

                  {/* Page editor */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {!selectedPage ? (
                      <div className="flex-1 flex items-center justify-center text-center">
                        <div>
                          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {pages && pages.length > 0 ? "Select a page to edit" : "Add a page to get started"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-2 border-b border-border shrink-0">
                          <input
                            className="w-full font-medium text-sm bg-transparent border-none outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
                            value={currentPageTitle}
                            onChange={(e) => setPageTitle((prev) => ({ ...prev, [selectedPageId!]: e.target.value }))}
                            placeholder="Page title"
                            data-testid="input-page-title"
                          />
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col" data-testid="input-page-content">
                          <RichTextEditor
                            key={selectedPageId}
                            content={plainTextToHtml(currentPageContent)}
                            onChange={(html) =>
                              setPageContent((prev) => ({ ...prev, [selectedPageId!]: htmlToPlainText(html) }))
                            }
                            placeholder="Write page content here..."
                            className="flex-1 overflow-hidden"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ExportModal bookId={bookId} open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
