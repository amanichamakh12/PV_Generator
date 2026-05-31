'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Document, AlignmentType } from 'docx';
import { Document as DocxDoc} from 'docx';
import { 
  Languages, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2,
  Download,
  Loader2,
  FileText,
  Check,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BorderStyle, LineRuleType, Packer, Paragraph, TextRun } from 'docx';
import { PVRenderer } from './PVRenderer';

const translatePV = async (content: string, targetLang: TranslationLang): Promise<string> => {
  const langMap = {
    arabic: 'ar',
    english: 'en',
  };
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(`${apiUrl}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pv: content,
      target_language: langMap[targetLang],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur traduction [${response.status}]: ${error}`);
  }

  const data = await response.json();
  return data.pv;
};
  

type TranslationLang = 'arabic' | 'english';

export function TranslationStep() {
  const { document, updateDocument, resetWorkflow } = useWorkflow();
  const [activeTab, setActiveTab] = useState<'french' | TranslationLang>('french');
  const [translatingLangs, setTranslatingLangs] = useState<Set<TranslationLang>>(new Set());
  const [validatedTranslations, setValidatedTranslations] = useState<Set<TranslationLang>>(new Set());

  const handleTranslate = async (lang: TranslationLang) => {
  if (!document?.finalContent) return;

  setTranslatingLangs(prev => new Set([...prev, lang]));

  try {
    const translation = await translatePV(document.finalContent, lang);  // ✅
    updateDocument({
      translations: {
        ...document.translations,
        [lang]: translation,
      },
    });
  } catch (err: any) {
    console.error('Erreur traduction:', err);
  } finally {
    setTranslatingLangs(prev => {
      const newSet = new Set(prev);
      newSet.delete(lang);
      return newSet;
    });
  }
};

  const handleRegenerateTranslation = async (lang: TranslationLang) => {
    setValidatedTranslations(prev => {
      const newSet = new Set(prev);
      newSet.delete(lang);
      return newSet;
    });
    updateDocument({
      translations: {
        ...document?.translations,
        [lang]: undefined
      }
    });
    await handleTranslate(lang);
  };

  const handleValidateTranslation = (lang: TranslationLang) => {
    setValidatedTranslations(prev => new Set([...prev, lang]));
  };

  const handleTranslationChange = (lang: TranslationLang, content: string) => {
    updateDocument({
      translations: {
        ...document?.translations,
        [lang]: content
      }
    });
  };

const handleDownload = async (lang: 'french' | TranslationLang) => {
  let content = '';
  let filename = '';

  if (lang === 'french') {
    content = document?.finalContent || '';
    filename = 'PV_Comite_Risques_FR.docx';
  } else if (lang === 'arabic') {
    content = document?.translations?.arabic || '';
    filename = 'PV_Comite_Risques_AR.docx';
  } else {
    content = document?.translations?.english || '';
    filename = 'PV_Comite_Risques_EN.docx';
  }

  if (!content) return;

  const doc = createDocxDocumentFromDraft(content, document?.participants ?? []);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function getRunsFromLine(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(part =>
    part.startsWith("**") && part.endsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true, font: "Calibri", size: 22 })
      : new TextRun({ text: part, font: "Calibri", size: 22 })
  );
}

function createDocxDocumentFromDraft(content: string, participants: string[] = []) {
  const paragraphs: Paragraph[] = [];
  const lines = content.replace(/\\n/g, '\n').split(/\r?\n/);

  const horizontalRule = new Paragraph({
    border: { bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE, space: 1 } },
    spacing: { after: 200 },
    children: [],
  });

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) { paragraphs.push(new Paragraph({ spacing: { after: 100 } })); return; }

    if (line === '---') {
      paragraphs.push(new Paragraph({ border: { bottom: { color: "CCCCCC", size: 4, style: BorderStyle.SINGLE, space: 1 } }, spacing: { after: 200 }, children: [] }));
      return;
    }

    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: line.replace('# ', ''), bold: true, size: 36, color: "000000", font: "Calibri" })] }));
      paragraphs.push(horizontalRule);
      return;
    }

    if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({ spacing: { before: 300, after: 120 }, border: { left: { color: "000000", size: 12, style: BorderStyle.SINGLE, space: 8 } }, indent: { left: 200 }, children: [new TextRun({ text: line.replace('## ', ''), bold: true, size: 28, color: "000000", font: "Calibri" })] }));
      return;
    }

    if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: line.replace('### ', ''), bold: true, italics: true, size: 24, color: "000000", font: "Calibri" })] }));
      return;
    }

    if (line.startsWith('- ')) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, indent: { left: 400, hanging: 200 }, children: [new TextRun({ text: `– ${line.replace('- ', '')}`, size: 22, color: "000000", font: "Calibri" })] }));
      return;
    }

    if (line.startsWith('• ')) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, indent: { left: 600, hanging: 200 }, children: [new TextRun({ text: line, size: 22, color: "000000", font: "Calibri" })] }));
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, indent: { left: 400 }, children: [new TextRun({ text: line, size: 22, color: "000000", font: "Calibri" })] }));
      return;
    }

    paragraphs.push(new Paragraph({ spacing: { after: 100 }, children: getRunsFromLine(line) }));
  });

  // Section signatures
  if (participants.length > 0) {
    paragraphs.push(new Paragraph({ spacing: { before: 600, after: 200 }, border: { bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE, space: 1 } }, children: [new TextRun({ text: "SIGNATURES", bold: true, size: 28, font: "Calibri", color: "000000" })] }));

    for (let i = 0; i < participants.length; i += 2) {
      const [leftName, leftRole] = participants[i].split(" — ");
      const right = participants[i + 1];
      const [rightName, rightRole] = right ? right.split(" — ") : ["", ""];

      paragraphs.push(new Paragraph({ spacing: { before: 400, after: 60 }, children: [new TextRun({ text: leftName, bold: true, size: 22, font: "Calibri" }), new TextRun({ text: "\t\t\t\t", size: 22 }), new TextRun({ text: rightName, bold: true, size: 22, font: "Calibri" })] }));
      paragraphs.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: leftRole || "", italics: true, size: 20, font: "Calibri", color: "444444" }), new TextRun({ text: "\t\t\t\t", size: 22 }), new TextRun({ text: rightRole || "", italics: true, size: 20, font: "Calibri", color: "444444" })] }));
      paragraphs.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "_______________________", size: 22, font: "Calibri" }), new TextRun({ text: "\t\t\t\t", size: 22 }), new TextRun({ text: rightName ? "_______________________" : "", size: 22, font: "Calibri" })] }));
    }
  }

  return new DocxDoc({
    styles: { default: { document: { run: { font: "Calibri", size: 22, color: "000000" }, paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: paragraphs }],
  });
}

  const handleDownloadAll = () => {
    handleDownload('french');
    if (document?.translations?.arabic) handleDownload('arabic');
    if (document?.translations?.english) handleDownload('english');
  };

  const handleNewPV = () => {
    resetWorkflow();
  };

  const allTranslationsValidated = 
    validatedTranslations.has('arabic') && 
    validatedTranslations.has('english');

  return (
    <div className="max-w-5xl mx-auto">
      {/* Success Banner */}
      {allTranslationsValidated && (
        <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-accent" />
            <div>
              <p className="font-medium text-accent">Processus Terminé!</p>
              <p className="text-sm text-muted-foreground">
                Le PV a été généré et traduit avec succès dans toutes les langues
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
              <Download className="w-4 h-4" />
              Tout Télécharger
            </Button>
            <Button onClick={handleNewPV} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Nouveau PV
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Languages className="w-6 h-6 text-primary" />
                Traduction du PV
              </CardTitle>
              <CardDescription className="mt-1">
                Traduisez le procès-verbal en arabe et en anglais
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={document?.translations?.arabic ? 'default' : 'secondary'}
                  className={cn(
                    document?.translations?.arabic && 'bg-accent'
                  )}
                >
                  {validatedTranslations.has('arabic') ? <Check className="w-3 h-3 mr-1" /> : null}
                  Arabe
                </Badge>
                <Badge 
                  variant={document?.translations?.english ? 'default' : 'secondary'}
                  className={cn(
                    document?.translations?.english && 'bg-accent'
                  )}
                >
                  {validatedTranslations.has('english') ? <Check className="w-3 h-3 mr-1" /> : null}
                  Anglais
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="french" className="gap-2">
                <FileText className="w-4 h-4" />
                Français
              </TabsTrigger>
              <TabsTrigger value="arabic" className="gap-2">
                <span className="text-lg">ع</span>
                Arabe
              </TabsTrigger>
              <TabsTrigger value="english" className="gap-2">
                <span className="font-bold">EN</span>
                Anglais
              </TabsTrigger>
            </TabsList>

            {/* French Tab */}
            <TabsContent value="french">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload('french')}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </Button>
                </div>
             {document?.finalContent && (
  <ScrollArea className="h-[450px] border rounded-lg p-4">
    <PVRenderer content={document.finalContent} />
  </ScrollArea>
)}
                
              </div>
            </TabsContent>

            {/* Arabic Tab */}
            <TabsContent value="arabic">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    {!document?.translations?.arabic && !translatingLangs.has('arabic') && (
                      <Button onClick={() => handleTranslate('arabic')} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Traduire en Arabe
                      </Button>
                    )}
                    {document?.translations?.arabic && !validatedTranslations.has('arabic') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateTranslation('arabic')}
                        className="gap-2"
                        disabled={translatingLangs.has('arabic')}
                      >
                        <RefreshCw className={cn('w-4 h-4', translatingLangs.has('arabic') && 'animate-spin')} />
                        Régénérer
                      </Button>
                    )}
                  </div>
                  {document?.translations?.arabic && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload('arabic')}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </Button>
                  )}
                </div>

                {translatingLangs.has('arabic') ? (
                  <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground">Traduction en arabe en cours...</p>
                    </div>
                  </div>
                ) : document?.translations?.arabic ? (
                  <>
                    <ScrollArea className="h-[450px] border rounded-lg p-4" dir="rtl">
        <PVRenderer content={document.translations.arabic} />
      </ScrollArea>
                    {!validatedTranslations.has('arabic') && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleValidateTranslation('arabic')}
                          className="gap-2 bg-accent hover:bg-accent/90"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Valider la traduction arabe
                        </Button>
                      </div>
                    )}
                    {validatedTranslations.has('arabic') && (
                      <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-accent" />
                        <span className="text-sm text-accent font-medium">
                          Traduction arabe validée
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30 border-dashed">
                    <div className="text-center space-y-2">
                      <Languages className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Cliquez sur &quot;Traduire en Arabe&quot; pour générer la traduction
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* English Tab */}
            <TabsContent value="english">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    {!document?.translations?.english && !translatingLangs.has('english') && (
                      <Button onClick={() => handleTranslate('english')} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Translate to English
                      </Button>
                    )}
                    {document?.translations?.english && !validatedTranslations.has('english') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateTranslation('english')}
                        className="gap-2"
                        disabled={translatingLangs.has('english')}
                      >
                        <RefreshCw className={cn('w-4 h-4', translatingLangs.has('english') && 'animate-spin')} />
                        Regenerate
                      </Button>
                    )}
                  </div>
                  {document?.translations?.english && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload('english')}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  )}
                </div>

                {translatingLangs.has('english') ? (
                  <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                      <p className="text-muted-foreground">Translating to English...</p>
                    </div>
                  </div>
                ) : document?.translations?.english ? (
                  <>
                   <ScrollArea className="h-[450px] border rounded-lg p-4">
        <PVRenderer content={document.translations.english} />
      </ScrollArea>
                    {!validatedTranslations.has('english') && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleValidateTranslation('english')}
                          className="gap-2 bg-accent hover:bg-accent/90"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Validate English translation
                        </Button>
                      </div>
                    )}
                    {validatedTranslations.has('english') && (
                      <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-accent" />
                        <span className="text-sm text-accent font-medium">
                          English translation validated
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30 border-dashed">
                    <div className="text-center space-y-2">
                      <Languages className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Click &quot;Translate to English&quot; to generate the translation
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

