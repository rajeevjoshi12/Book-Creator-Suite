import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useCreateBook,
  useCreateChapter,
  useParseText,
  getListBooksQueryKey,
  getGetLibraryStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, FileText, File, Loader2, BookOpen, ChevronRight } from "lucide-react";

type Tab = "paste" | "pdf" | "docx";

interface ParsedChapter {
  title: string;
  type: "chapter" | "subchapter" | "section";
  content: string;
}

interface ParseResult {
  suggestedTitle: string;
  chapters: ParsedChapter[];
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function apiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

export default function NewBookPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("paste");
  const [pasteText, setPasteText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [step, setStep] = useState<"input" | "review">("input");
  const pdfRef = useRef<HTMLInputElement>(null);
  const docxRef = useRef<HTMLInputElement>(null);

  const parseText = useParseText();
  const createBook = useCreateBook();
  const createChapter = useCreateChapter();

  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      toast({ title: "Please paste some text first", variant: "destructive" });
      return;
    }
    parseText.mutate(
      { data: { text: pasteText } },
      {
        onSuccess: (result) => {
          setParseResult(result);
          setBookTitle(result.suggestedTitle);
          setStep("review");
        },
        onError: () => toast({ title: "Failed to parse text", variant: "destructive" }),
      },
    );
  };

  const handleFileUpload = async (file: File, type: "pdf" | "docx") => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiUrl(`/parse/${type}`), { method: "POST", body: formData });
      if (!res.ok) throw new Error("Parse failed");
      const result: ParseResult = await res.json();
      setParseResult(result);
      setBookTitle(result.suggestedTitle);
      setStep("review");
    } catch {
      toast({ title: "Failed to parse file. Ensure it contains extractable text.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: "pdf" | "docx") => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, type);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent, type: "pdf" | "docx") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file, type);
  };

  const handleCreateBook = async () => {
    if (!bookTitle.trim()) {
      toast({ title: "Please enter a book title", variant: "destructive" });
      return;
    }
    if (!parseResult) return;

    const COVER_COLORS = [
      "#2d4a6e", "#4a2d6e", "#2d6e4a", "#6e4a2d", "#6e2d4a",
      "#1a5c6b", "#5c1a2d", "#3d5c1a", "#1a3d5c", "#5c3d1a",
    ];
    const coverColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];

    createBook.mutate(
      { data: { title: bookTitle.trim(), author: bookAuthor.trim() || undefined, coverColor } },
      {
        onSuccess: async (book) => {
          for (let i = 0; i < parseResult.chapters.length; i++) {
            const ch = parseResult.chapters[i];
            await new Promise<void>((resolve) => {
              createChapter.mutate(
                {
                  bookId: book.id,
                  data: {
                    title: ch.title,
                    type: ch.type,
                    content: ch.content,
                    sortOrder: i,
                  },
                },
                { onSettled: () => resolve() },
              );
            });
          }
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLibraryStatsQueryKey() });
          toast({ title: "Book created!" });
          setLocation(`/editor/${book.id}`);
        },
        onError: () => toast({ title: "Failed to create book", variant: "destructive" }),
      },
    );
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "paste", label: "Paste Text", icon: <FileText className="w-4 h-4" /> },
    { id: "pdf", label: "Upload PDF", icon: <File className="w-4 h-4" /> },
    { id: "docx", label: "Upload Word Doc", icon: <File className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-back"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-serif text-lg font-medium">New Book</h1>
            <p className="text-xs text-muted-foreground">
              {step === "input" ? "Import your content" : "Review and create"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {step === "input" && (
          <div>
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Paste text */}
            {activeTab === "paste" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Paste text from ChatGPT, Gemini, Claude, Perplexity, or any other source. The app will automatically detect chapters and structure.
                </p>
                <textarea
                  data-testid="input-paste-text"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your content here..."
                  className="w-full h-80 p-4 rounded-lg border border-border bg-card text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex items-center gap-3">
                  <Button
                    data-testid="button-parse-text"
                    onClick={handlePasteParse}
                    disabled={parseText.isPending || !pasteText.trim()}
                    className="gap-2"
                  >
                    {parseText.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Parse & Structure
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {pasteText.length.toLocaleString()} characters
                  </span>
                </div>
              </div>
            )}

            {/* PDF upload */}
            {activeTab === "pdf" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a PDF file. The text will be extracted and automatically organized into chapters.
                </p>
                <div
                  data-testid="dropzone-pdf"
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/2 transition-colors"
                  onClick={() => pdfRef.current?.click()}
                  onDrop={(e) => handleDrop(e, "pdf")}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                  ) : (
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                  )}
                  <p className="font-medium mb-1">
                    {isUploading ? "Processing PDF..." : "Drop your PDF here"}
                  </p>
                  <p className="text-sm text-muted-foreground">or click to browse — up to 50 MB</p>
                </div>
                <input
                  ref={pdfRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleFileInputChange(e, "pdf")}
                />
              </div>
            )}

            {/* DOCX upload */}
            {activeTab === "docx" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a Word document (.docx). Headings and structure will be preserved as chapters.
                </p>
                <div
                  data-testid="dropzone-docx"
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/2 transition-colors"
                  onClick={() => docxRef.current?.click()}
                  onDrop={(e) => handleDrop(e, "docx")}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                  ) : (
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                  )}
                  <p className="font-medium mb-1">
                    {isUploading ? "Processing document..." : "Drop your Word document here"}
                  </p>
                  <p className="text-sm text-muted-foreground">or click to browse (.docx) — up to 50 MB</p>
                </div>
                <input
                  ref={docxRef}
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={(e) => handleFileInputChange(e, "docx")}
                />
              </div>
            )}
          </div>
        )}

        {/* Review step */}
        {step === "review" && parseResult && (
          <div className="space-y-8">
            {/* Book details */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h2 className="font-serif text-lg font-medium">Book Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    data-testid="input-book-title"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Enter book title"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Author (optional)</label>
                  <Input
                    data-testid="input-book-author"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              </div>
            </div>

            {/* Chapter preview */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-medium">
                  Detected Structure ({parseResult.chapters.length} chapters)
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("input")}
                  className="text-muted-foreground"
                >
                  Edit content
                </Button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {parseResult.chapters.map((ch, i) => (
                  <div
                    key={i}
                    data-testid={`chapter-preview-${i}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      ch.type === "chapter"
                        ? "border-border bg-card"
                        : "border-border/50 bg-muted/30 ml-4"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground mt-0.5 min-w-5">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            ch.type === "chapter"
                              ? "bg-primary/10 text-primary"
                              : ch.type === "subchapter"
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ch.type}
                        </span>
                        <p className="text-sm font-medium truncate">{ch.title}</p>
                      </div>
                      {ch.content && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {ch.content.slice(0, 120)}...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                data-testid="button-create-book"
                onClick={handleCreateBook}
                disabled={createBook.isPending || !bookTitle.trim()}
                className="gap-2"
              >
                {createBook.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                Create Book
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStep("input"); setParseResult(null); }}
              >
                Start over
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
