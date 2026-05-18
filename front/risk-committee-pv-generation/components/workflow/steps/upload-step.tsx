'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Presentation, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Slide, AgendaItem, PVDocument } from '@/types/pv-generator';

// Mock function to simulate PowerPoint extraction
const mockExtractPowerPoint = async (file: File): Promise<{ slides: Slide[]; agendaItems: AgendaItem[] }> => {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const mockSlides: Slide[] = [
    {
      id: 'slide-1',
      slideNumber: 1,
      title: 'Introduction - Contexte du Comité',
      content: 'Présentation du contexte général du comité des risques et des objectifs de la réunion.',
      contentBlocks: ['Présentation du contexte général du comité des risques et des objectifs de la réunion.'],
      tables: [],
      charts: [],
      images: [],
      notes: null,
      extractedContent: 'Le comité des risques se réunit pour examiner les indicateurs clés de performance et les risques identifiés au cours du trimestre.',
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: 'agenda-1'
    },
    {
      id: 'slide-2',
      slideNumber: 2,
      title: 'Risques Opérationnels',
      content: 'Analyse des risques opérationnels identifiés.',
      contentBlocks: ['Analyse des risques opérationnels identifiés.'],
      tables: [],
      charts: [],
      images: [],
      notes: null,
      extractedContent: 'Les risques opérationnels majeurs incluent: défaillance des systèmes IT, erreurs de traitement, et non-conformité réglementaire.',
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: 'agenda-2'
    },
    {
      id: 'slide-3',
      slideNumber: 3,
      title: 'Plan de Mitigation',
      content: 'Stratégies de mitigation proposées.',
      contentBlocks: ['Stratégies de mitigation proposées.'],
      tables: [],
      charts: [],
      images: [],
      notes: null,
      extractedContent: 'Plan de mitigation incluant: renforcement des contrôles internes, formation du personnel, et mise à jour des procédures.',
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: 'agenda-2'
    },
    {
      id: 'slide-4',
      slideNumber: 4,
      title: 'Risques Financiers',
      content: 'Évaluation des risques financiers.',
      contentBlocks: ['Évaluation des risques financiers.'],
      tables: [],
      charts: [],
      images: [],
      notes: null,
      extractedContent: 'Analyse des risques de marché, risques de crédit et risques de liquidité avec leurs impacts potentiels.',
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: 'agenda-3'
    },
    {
      id: 'slide-5',
      slideNumber: 5,
      title: 'Conclusions et Actions',
      content: 'Synthèse et prochaines étapes.',
      contentBlocks: ['Synthèse et prochaines étapes.'],
      tables: [],
      charts: [],
      images: [],
      notes: null,
      extractedContent: 'Récapitulatif des décisions prises et des actions à entreprendre avant le prochain comité.',
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: 'agenda-4'
    }
  ];

  const mockAgendaItems: AgendaItem[] = [
    {
      id: 'agenda-1',
      title: 'Introduction et Contexte',
      order: 1,
      slides: mockSlides.filter(s => s.agendaItemId === 'agenda-1'),
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      notes: []
    },
    {
      id: 'agenda-2',
      title: 'Risques Opérationnels et Mitigation',
      order: 2,
      slides: mockSlides.filter(s => s.agendaItemId === 'agenda-2'),
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      notes: []
    },
    {
      id: 'agenda-3',
      title: 'Risques Financiers',
      order: 3,
      slides: mockSlides.filter(s => s.agendaItemId === 'agenda-3'),
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      notes: []
    },
    {
      id: 'agenda-4',
      title: 'Conclusions et Plan d\'Action',
      order: 4,
      slides: mockSlides.filter(s => s.agendaItemId === 'agenda-4'),
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      notes: []
    }
  ];

  return { slides: mockSlides, agendaItems: mockAgendaItems };
};

export function UploadStep() {
  const { setSlides, setAgendaItems, setDocument, setCurrentStep, setProcessing, isProcessing } = useWorkflow();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

const onDrop = useCallback(async (acceptedFiles: File[]) => {
  console.log('🟡 onDrop déclenché', acceptedFiles);
  
  const file = acceptedFiles[0];
  if (!file) {
    console.log('❌ Aucun fichier reçu');
    return;
  }

  console.log('📁 Fichier:', file.name, file.type, file.size);

  // Validation type
  const validTypes = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  if (!validTypes.includes(file.type) && !file.name.endsWith('.pptx') && !file.name.endsWith('.ppt')) {
    console.log('❌ Type invalide:', file.type);
    setUploadStatus('error');
    setErrorMessage('Veuillez importer un fichier PowerPoint (.ppt ou .pptx)');
    return;
  }

  setUploadedFile(file);
  setUploadStatus('uploading');
  setProcessing(true);
 try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
    console.log('🌐 Appel API vers:', `${apiUrl}/api/parse-pptx`);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${apiUrl}/api/parse-pptx`, {
      method: 'POST',
      body: formData,
    });

    console.log('📡 Réponse reçue, status:', res.status, res.ok);

    if (!res.ok) {
      const txt = await res.text();
      console.error('❌ Erreur API:', res.status, txt);
      throw new Error(txt || `API error ${res.status}`);
    }

    const data = await res.json();
    console.log('✅ Data reçue:', data);

      const rawSlides: any[] = data.slides || [];

      const agendaMap = new Map<string, string>();

const mappedSlides: Slide[] = rawSlides.map((s, idx) => {
  const agendaTitle = (s['ordre du jour'] || s['ordre_du_jour'] || '').toString().trim();
  let agendaId = '';
  if (agendaTitle) {
    if (!agendaMap.has(agendaTitle)) agendaMap.set(agendaTitle, `agenda-${agendaMap.size + 1}`);
    agendaId = agendaMap.get(agendaTitle) as string;
  }

  const title = (s.titre || s.title || '').toString();
  const contentField = s.contenu || s.content || [];
  const content = Array.isArray(contentField) ? contentField.join('\n') : (contentField || '').toString();
  const extractedContent = (s.texte || s.extracted_text || content).toString();

  return {
    id: `slide-${idx + 1}`,
    slideNumber: s.index || s.slide_index || idx + 1,
    title,
    content,
    extractedContent,
    analysis: '',
    isAnalyzed: false,
    isValidated: false,
    agendaItemId: agendaId,

    // ✅ Champs manquants — ajouter ces lignes :
    contentBlocks: Array.isArray(s.contenu) ? s.contenu : [],
    tables: s.tableaux || [],
    charts: s.graphiques || [],
    images: s.images || [],
    notes: s.notes || null,
  } as Slide;
});

      const mappedAgendaItems: AgendaItem[] = Array.from(agendaMap.keys()).map((title, i) => {
        const id = `agenda-${i + 1}`;
        return {
          id,
          title,
          order: i + 1,
          slides: mappedSlides.filter(s => s.agendaItemId === id),
          analysis: '',
          isAnalyzed: false,
          isValidated: false,
          notes: [],
        } as AgendaItem;
      });

      setSlides(mappedSlides);
      setAgendaItems(mappedAgendaItems);

      const newDocument: PVDocument = {
        id: `pv-${Date.now()}`,
        title: `PV Comité des Risques - ${new Date().toLocaleDateString('fr-FR')}`,
        date: new Date(),
        committeeType: 'Comité des Risques',
        participants: [],
        agendaItems: mappedAgendaItems,
        draftContent: '',
        finalContent: '',
        status: 'draft',
        translations: {},
      };
      setDocument(newDocument);

      setUploadStatus('success');
  } catch (err: any) {
    // Distinguer erreur réseau vs erreur API
    if (err instanceof TypeError) {
      console.error('🔌 Erreur RÉSEAU (API injoignable):', err.message);
      setErrorMessage(`Serveur injoignable sur ${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'} — vérifiez que le backend tourne`);
    } else {
      console.error('💥 Erreur API:', err.message);
      setErrorMessage(err?.message || 'Erreur lors du traitement du fichier');
    }
    setUploadStatus('error');
  } finally {
    setProcessing(false);
  }
}, [setSlides, setAgendaItems, setDocument, setProcessing]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
    },
    multiple: false,
    disabled: isProcessing
  });

  const handleContinue = () => {
    setCurrentStep('extract');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-2 border-dashed border-primary/30 bg-card/50 backdrop-blur">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Presentation className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Importer le Support de Comité</CardTitle>
          <CardDescription className="text-base">
            Glissez-déposez votre présentation PowerPoint ou cliquez pour sélectionner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
              isDragActive && 'border-primary bg-primary/5 scale-[1.02]',
              !isDragActive && uploadStatus === 'idle' && 'border-border hover:border-primary/50 hover:bg-muted/50',
              uploadStatus === 'uploading' && 'border-info bg-info/5',
              uploadStatus === 'success' && 'border-accent bg-accent/5',
              uploadStatus === 'error' && 'border-destructive bg-destructive/5',
              isProcessing && 'pointer-events-none opacity-70'
            )}
          >
            <input {...getInputProps()} />
            
            {uploadStatus === 'idle' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Upload className={cn('w-10 h-10 text-muted-foreground', isDragActive && 'text-primary')} />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {isDragActive ? 'Déposez le fichier ici...' : 'Glissez votre fichier PowerPoint ici'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ou <span className="text-primary font-medium">cliquez pour parcourir</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formats acceptés: .ppt, .pptx (max 50MB)
                </p>
              </div>
            )}

            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-info/20 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-info border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Traitement en cours...</p>
                  <p className="text-sm text-muted-foreground mt-1">{uploadedFile?.name}</p>
                </div>
                <div className="w-48 mx-auto h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-info rounded-full animate-pulse" style={{ width: '70%' }} />
                </div>
              </div>
            )}

            {uploadStatus === 'success' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Fichier importé avec succès!</p>
                  <p className="text-sm text-muted-foreground mt-1">{uploadedFile?.name}</p>
                </div>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Erreur d&apos;importation</p>
                  <p className="text-sm text-destructive mt-1">{errorMessage}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadStatus('idle');
                    setUploadedFile(null);
                  }}
                >
                  Réessayer
                </Button>
              </div>
            )}
          </div>

          {uploadStatus === 'success' && (
            <div className="mt-6 flex justify-center">
              <Button size="lg" onClick={handleContinue} className="gap-2">
                Continuer vers l&apos;extraction
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
