'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

// Mock translation function
const mockTranslate = async (content: string, targetLang: 'arabic' | 'english'): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (targetLang === 'arabic') {
    return `# محضر الاجتماع
## لجنة المخاطر

**التاريخ:** ${new Date().toLocaleDateString('ar-SA')}

---

### المشاركون

*سيتم استكمالها خلال الاجتماع*

---

### جدول الأعمال

تمت مناقشة النقاط التالية خلال اجتماع لجنة المخاطر:

1. مقدمة وسياق
2. المخاطر التشغيلية والتخفيف
3. المخاطر المالية
4. الاستنتاجات وخطة العمل

---

### ملخص المناقشات

تم تحليل جميع المخاطر المحددة وتمت الموافقة على خطط التخفيف المقترحة.

**القرارات المتخذة:**
- التحقق من صحة التدابير التصحيحية المقترحة
- تخصيص الموارد اللازمة
- الجدول الزمني للتنفيذ

---

### الخطوات التالية

المتابعة الشهرية للمؤشرات وتقديم تقرير التقدم في الاجتماع القادم.

---

**الحالة:** ✓ تم التحقق
**تاريخ الترجمة:** ${new Date().toLocaleDateString('ar-SA')}
`;
  } else {
    return `# MEETING MINUTES
## Risk Committee

**Date:** ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

**Committee Type:** Risk Committee

---

### PARTICIPANTS

*To be completed during the meeting*

---

### AGENDA

The following items were discussed during the Risk Committee meeting:

1. Introduction and Context
2. Operational Risks and Mitigation
3. Financial Risks
4. Conclusions and Action Plan

---

### DISCUSSION SUMMARY

All identified risks were analyzed and proposed mitigation plans were approved.

**Decisions Made:**
- Validation of proposed corrective measures
- Allocation of necessary resources
- Implementation timeline

**Actions to be Taken:**
- Monthly monitoring of indicators
- Progress report at next committee
- Documentation of lessons learned

---

### NEXT STEPS

To be defined based on the decisions made during the meeting.

---

### NEXT MEETING

*Date to be confirmed*

---

**Status:** ✓ Validated
**Translation Date:** ${new Date().toLocaleDateString('en-US')}
`;
  }
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
      const translation = await mockTranslate(document.finalContent, lang);
      updateDocument({
        translations: {
          ...document.translations,
          [lang]: translation
        }
      });
    } catch {
      console.error('Error translating');
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

  const handleDownload = (lang: 'french' | TranslationLang) => {
    let content = '';
    let filename = '';

    if (lang === 'french') {
      content = document?.finalContent || '';
      filename = 'PV_Comite_Risques_FR.md';
    } else if (lang === 'arabic') {
      content = document?.translations?.arabic || '';
      filename = 'PV_Comite_Risques_AR.md';
    } else {
      content = document?.translations?.english || '';
      filename = 'PV_Comite_Risques_EN.md';
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
                <ScrollArea className="h-[450px] border rounded-lg p-4">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {document?.finalContent}
                  </div>
                </ScrollArea>
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
                    <Textarea
                      value={document.translations.arabic}
                      onChange={(e) => handleTranslationChange('arabic', e.target.value)}
                      className="min-h-[400px] resize-none font-mono text-sm text-right"
                      dir="rtl"
                      disabled={validatedTranslations.has('arabic')}
                    />
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
                    <Textarea
                      value={document.translations.english}
                      onChange={(e) => handleTranslationChange('english', e.target.value)}
                      className="min-h-[400px] resize-none font-mono text-sm"
                      disabled={validatedTranslations.has('english')}
                    />
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
