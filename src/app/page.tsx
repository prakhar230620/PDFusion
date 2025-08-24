"use client";

import { useState, useRef, useMemo } from 'react';
import { Plus, Image as ImageIcon, FileText, Trash2, Copy, ArrowLeft, ArrowRight, Share2, Download, Pencil } from 'lucide-react';
import jsPDF from 'jspdf';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface PdfPage {
  id: string;
  image: string;
  text: string;
}

export default function Home() {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedPage = useMemo(() => {
    return pages.find(p => p.id === selectedPageId) || null;
  }, [pages, selectedPageId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newPagesPromises = Array.from(files).map(file => {
      return new Promise<PdfPage>(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            image: e.target?.result as string,
            text: '',
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newPagesPromises).then(newPages => {
      const allPages = [...pages, ...newPages];
      setPages(allPages);
      if (!selectedPageId) {
        setSelectedPageId(allPages[0].id);
      }
    });

    event.target.value = '';
  };

  const handleAddPageClick = () => fileInputRef.current?.click();

  const handleDeletePage = (pageId: string) => {
    setPages(prev => {
      const newPages = prev.filter(p => p.id !== pageId);
      if (selectedPageId === pageId) {
        setSelectedPageId(newPages.length > 0 ? newPages[0].id : null);
      }
      return newPages;
    });
  };

  const handleDuplicatePage = (pageId: string) => {
    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex > -1) {
      const pageToDuplicate = pages[pageIndex];
      const newPage: PdfPage = { ...pageToDuplicate, id: `${Date.now()}-${Math.random()}` };
      const newPages = [...pages];
      newPages.splice(pageIndex + 1, 0, newPage);
      setPages(newPages);
    }
  };

  const handleMovePage = (pageId: string, direction: 'left' | 'right') => {
    const index = pages.findIndex(p => p.id === pageId);
    if (index === -1) return;
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < pages.length) {
      const newPages = [...pages];
      [newPages[index], newPages[newIndex]] = [newPages[newIndex], newPages[index]];
      setPages(newPages);
    }
  };
  
  const handleOpenTextEditor = () => {
    if (selectedPage) {
      setCurrentText(selectedPage.text);
      setIsEditingText(true);
    }
  };

  const handleSaveText = () => {
    if (selectedPageId) {
      setPages(pages.map(p => p.id === selectedPageId ? { ...p, text: currentText } : p));
    }
    setIsEditingText(false);
  };

  const generatePdf = async (outputType: 'save' | 'share') => {
    if (pages.length === 0) {
      toast({ title: "Cannot generate PDF", description: "Please add at least one page.", variant: "destructive" });
      return;
    }

    toast({ title: "Generating PDF...", description: "Please wait a moment." });

    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();
        const page = pages[i];
        
        const img = new window.Image();
        img.src = page.image;
        await new Promise(resolve => { img.onload = resolve; });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const availableWidth = pageWidth - margin * 2;
        let availableHeight = pageHeight - margin * 2;

        let yPos = margin;
        
        if (page.text) {
          availableHeight = (pageHeight / 2) - margin * 1.5;
        }

        const imgRatio = img.width / img.height;
        const pageRatio = availableWidth / availableHeight;
        let imgDisplayWidth, imgDisplayHeight;

        if (imgRatio > pageRatio) {
          imgDisplayWidth = availableWidth;
          imgDisplayHeight = availableWidth / imgRatio;
        } else {
          imgDisplayHeight = availableHeight;
          imgDisplayWidth = availableHeight * imgRatio;
        }
        
        doc.addImage(img, 'JPEG', (pageWidth - imgDisplayWidth) / 2, yPos, imgDisplayWidth, imgDisplayHeight);
        
        if (page.text) {
          doc.setFont('PT Sans');
          doc.setFontSize(12);
          const textYPos = (pageHeight / 2) + margin / 2;
          const textLines = doc.splitTextToSize(page.text, availableWidth);
          doc.text(textLines, margin, textYPos);
        }
      }

      if (outputType === 'save') {
        doc.save('PDFusion_document.pdf');
        toast({ title: "Success!", description: "PDF saved to your device." });
      } else {
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], 'PDFusion_document.pdf', { type: 'application/pdf' });
        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({ title: 'PDF Document from PDFusion', files: [pdfFile] });
        } else {
          toast({ title: "Share Not Supported", description: "Your browser does not support sharing files.", variant: "destructive" });
          doc.save('PDFusion_document.pdf');
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <header className="absolute top-0 left-0 right-0 p-4">
          <h1 className="text-2xl font-headline font-bold text-primary">PDFusion</h1>
        </header>
        <div className="text-center">
            <FileText className="mx-auto h-24 w-24 text-primary opacity-50" />
            <h2 className="mt-6 text-2xl font-headline font-semibold">Create PDFs on the Go</h2>
            <p className="mt-2 text-muted-foreground">Import images from your gallery to start.</p>
        </div>
        <Button
            size="icon"
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 focus:ring-accent animate-pulse"
            onClick={handleAddPageClick}
            aria-label="Create new PDF"
          >
            <Plus className="h-8 w-8" />
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      <header className="flex items-center justify-between p-2 border-b shrink-0">
        <h1 className="text-xl font-headline font-bold text-primary">PDFusion</h1>
        <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => generatePdf('share')} aria-label="Share PDF"><Share2 /></Button>
            <Button variant="ghost" size="icon" onClick={() => generatePdf('save')} aria-label="Download PDF"><Download /></Button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden">
        <Card className="w-full h-full shadow-md flex items-center justify-center relative overflow-auto bg-muted/50">
          {selectedPage ? (
            <div className="relative w-full h-full">
              <Image src={selectedPage.image} alt="Page preview" fill style={{ objectFit: 'contain' }} data-ai-hint="document photo" />
              <Button
                variant="secondary" size="icon"
                className="absolute top-2 right-2 rounded-full bg-background/80 hover:bg-background shadow-lg"
                onClick={handleOpenTextEditor}>
                <Pencil className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <ImageIcon className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-4">Select a page below or add a new one.</p>
            </div>
          )}
        </Card>
      </main>

      <footer className="bg-card border-t p-2 shrink-0">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 p-2">
            {pages.map((page, index) => {
                const isSelected = selectedPageId === page.id;
                return (
                  <div key={page.id} className="relative group shrink-0">
                    <Card 
                      className={`h-28 w-20 cursor-pointer overflow-hidden ring-offset-background transition-all ${isSelected ? 'ring-2 ring-accent ring-offset-2' : 'hover:ring-2 hover:ring-primary/50'}`}
                      onClick={() => setSelectedPageId(page.id)}
                    >
                      <Image src={page.image} alt={`Page ${index + 1}`} fill style={{objectFit: 'cover'}} />
                      <div className="absolute inset-0 bg-black/20" />
                      <span className="absolute bottom-1 right-1 text-xs font-bold text-white bg-black/50 rounded-full h-5 w-5 flex items-center justify-center">{index + 1}</span>
                    </Card>
                     {isSelected && (
                        <div className="absolute -top-2 -right-2 flex flex-col gap-1 z-10">
                            <Button variant="destructive" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleDeletePage(page.id)}><Trash2 className="h-3 w-3"/></Button>
                            <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full" onClick={() => handleDuplicatePage(page.id)}><Copy className="h-3 w-3"/></Button>
                        </div>
                     )}
                     {isSelected && (
                         <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1 z-10">
                           <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full bg-background/70" disabled={index === 0} onClick={() => handleMovePage(page.id, 'left')}><ArrowLeft className="h-4 w-4"/></Button>
                           <Button variant="secondary" size="icon" className="h-6 w-6 rounded-full bg-background/70" disabled={index === pages.length - 1} onClick={() => handleMovePage(page.id, 'right')}><ArrowRight className="h-4 w-4"/></Button>
                        </div>
                     )}
                  </div>
                )
            })}
            <Button variant="outline" className="h-28 w-20 flex-col gap-1" onClick={handleAddPageClick}>
              <Plus className="h-6 w-6" />
              <span>Add Page</span>
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </footer>
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple className="hidden" />
      <Dialog open={isEditingText} onOpenChange={setIsEditingText}>
        <DialogContent className="max-w-[90vw] rounded-lg">
            <DialogHeader><DialogTitle>Edit Page Text</DialogTitle></DialogHeader>
            <Textarea value={currentText} onChange={(e) => setCurrentText(e.target.value)} rows={10} placeholder="Add text for this page..." />
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSaveText}>Save Text</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
