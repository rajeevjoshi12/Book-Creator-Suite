import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download, FileText, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportModalProps {
  bookId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ bookId, open, onOpenChange }: ExportModalProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "pdf" | "docx" | "mobi") => {
    setIsExporting(true);
    try {
      // Use window.location.href or a hidden link for file download
      window.location.href = `/api/export/${bookId}/${format}`;
      toast({
        title: "Export started",
        description: `Your ${format.toUpperCase()} file is being generated and will download shortly.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error generating your file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Export Book</DialogTitle>
          <DialogDescription>
            Choose a format to download your formatted digital book.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="flex items-center justify-start gap-4 h-16 px-4 hover:border-primary transition-colors"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            <div className="bg-primary/5 p-2 rounded-md text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium text-base">PDF</span>
              <span className="text-xs text-muted-foreground">Print-ready and Kindle-friendly</span>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center justify-start gap-4 h-16 px-4 hover:border-primary transition-colors"
            onClick={() => handleExport("mobi")}
            disabled={isExporting}
          >
            <div className="bg-primary/5 p-2 rounded-md text-primary">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium text-base">Kindle (.mobi)</span>
              <span className="text-xs text-muted-foreground">Mobipocket format for all Kindle devices and apps</span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-4 h-16 px-4 hover:border-primary transition-colors"
            onClick={() => handleExport("docx")}
            disabled={isExporting}
          >
            <div className="bg-primary/5 p-2 rounded-md text-primary">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-medium text-base">Word Document (.docx)</span>
              <span className="text-xs text-muted-foreground">For further editing and formatting</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
