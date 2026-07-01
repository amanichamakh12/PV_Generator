'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Download,
  MessageSquare,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  User,
  Clock,
  Edit3,
  Save,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Loader2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';



export function MeetingNotesStep() {
  const { agendaItems, addMeetingNote, updateMeetingNote, deleteMeetingNote, updateAgendaItem, setCurrentStep, document, sessionId } = useWorkflow();

  const [activePanel, setActivePanel] = useState<'notes' | 'recommendations'>('notes');
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaItems[0]?.id || null);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isReformulating, setIsReformulating] = useState(false);
  const [reformulatingNoteId, setReformulatingNoteId] = useState<string | null>(null);
  const [synthesizingAgendaId, setSynthesizingAgendaId] = useState<string | null>(null);

  const [newRecoSpeaker, setNewRecoSpeaker] = useState('');
  const [newRecoContent, setNewRecoContent] = useState('');

  const participants = document?.participants || [];
  const selectedAgenda = agendaItems.find(a => a.id === selectedAgendaId);

  // Séparer notes et recommandations (stockées ensemble dans agendaItem.notes avec type)
  const getAgendaNotes = (agendaId: string) =>
    agendaItems.find(a => a.id === agendaId)?.notes.filter(n => n.type !== 'recommendation') ?? [];
  const getAgendaRecos = (agendaId: string) =>
    agendaItems.find(a => a.id === agendaId)?.notes.filter(n => n.type === 'recommendation') ?? [];

  const allRecommendations = agendaItems.flatMap(a =>
    a.notes.filter(n => n.type === 'recommendation').map(n => ({ ...n, agendaTitle: a.title, agendaOrder: a.order }))
  );
  const totalNotes = agendaItems.reduce((acc, a) => acc + a.notes.filter(n => n.type !== 'recommendation').length, 0);

  // ── Note handlers ──────────────────────────────────────────────────────────

  const handleAddNote = () => {
    if (!selectedAgendaId || !newSpeaker.trim() || !newContent.trim()) return;
    addMeetingNote(
      selectedAgendaId,
      { speaker: newSpeaker.trim(), content: newContent.trim(), timestamp: new Date() },
      selectedAgenda?.db_id,
    );
    setNewSpeaker('');
    setNewContent('');
  };

  const handleEditNote = (noteId: string, content: string) => {
    setEditingNoteId(noteId);
    setEditContent(content);
  };

  const handleSaveEdit = (agendaId: string, noteId: string) => {
    updateMeetingNote(agendaId, noteId, editContent);
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleDeleteNote = (agendaId: string, noteId: string, noteDbId?: number) => {
    deleteMeetingNote(agendaId, noteId, noteDbId);
  };

  const reformulateForPV = async (text: string): Promise<string> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
    const response = await fetch(`${apiUrl}/api/reformulate-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    if (!response.ok) throw new Error('Erreur de reformulation');
    const data = await response.json();
    return data.text;
  };

  const handleReformulateNote = async (agendaId: string, noteId: string, content: string) => {
    try {
      setIsReformulating(true);
      setReformulatingNoteId(noteId);
      const reformulated = await reformulateForPV(content);
      updateMeetingNote(agendaId, noteId, reformulated);
    } finally {
      setIsReformulating(false);
      setReformulatingNoteId(null);
    }
  };

  // ── Recommendation handlers ────────────────────────────────────────────────

  const handleAddRecommendation = () => {
    if (!selectedAgendaId || !newRecoSpeaker.trim() || !newRecoContent.trim()) return;
    addMeetingNote(
      selectedAgendaId,
      { speaker: newRecoSpeaker.trim(), content: newRecoContent.trim(), timestamp: new Date(), type: 'recommendation' },
      selectedAgenda?.db_id,
    );
    setNewRecoSpeaker('');
    setNewRecoContent('');
  };

  const handleDeleteRecommendation = (agendaId: string, noteId: string, noteDbId?: number) => {
    deleteMeetingNote(agendaId, noteId, noteDbId);
  };

  const handleExportRecommendations = () => {
    if (allRecommendations.length === 0) return;
    const headers = ['Ordre du Jour', 'Participant', 'Recommandation', 'Heure'];
    const rows = allRecommendations.map(r => [
      `${r.agendaOrder}. ${r.agendaTitle}`,
      r.speaker,
      r.content,
      r.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `Recommandations_${new Date().toISOString().split('T')[0]}.csv`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Synthesis ──────────────────────────────────────────────────────────────

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

  const handleSynthesizeNotes = async (agendaId: string) => {
    const agenda = agendaItems.find(a => a.id === agendaId);
    if (!agenda || agenda.notes.length === 0) return;

    setSynthesizingAgendaId(agendaId);
    try {
      const res = await fetch(`${apiUrl}/api/reformulate-agenda-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: agenda.notes.map(n => ({ speaker: n.speaker, content: n.content })),
          agenda_title: agenda.title,
          session_id: sessionId ?? undefined,
          agenda_item_index: agenda.order,
        }),
      });
      if (!res.ok) throw new Error('Erreur synthèse');
      const data = await res.json();
      const synthesized: string = data.text ?? '';
      updateAgendaItem(agendaId, { reformulatedNotes: synthesized });
    } catch {
      // silent — user can retry
    } finally {
      setSynthesizingAgendaId(null);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleContinue = () => setCurrentStep('final-pv');
  const handleBack = () => setCurrentStep('draft-generation');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Status Banner + Toggle */}
      <div className="flex items-center justify-between p-4 bg-warning/10 border border-warning/20 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
          <div>
            <p className="font-medium text-warning-foreground">Réunion en cours</p>
            <p className="text-sm text-muted-foreground">
              {totalNotes} note{totalNotes !== 1 ? 's' : ''} •{' '}
              {allRecommendations.length} recommandation{allRecommendations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setActivePanel('notes')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              activePanel === 'notes'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Notes
            {totalNotes > 0 && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                activePanel === 'notes' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20',
              )}>
                {totalNotes}
              </span>
            )}
          </button>
          <button
            onClick={() => setActivePanel('recommendations')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-border',
              activePanel === 'recommendations'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            <Lightbulb className="w-4 h-4" />
            Recommandations
            {allRecommendations.length > 0 && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                activePanel === 'recommendations' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20',
              )}>
                {allRecommendations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Panel: Notes ── */}
      <div className={cn('space-y-6', activePanel !== 'notes' && 'hidden')}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agenda List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Ordres du Jour
            </CardTitle>
            <CardDescription>Sélectionnez pour ajouter des notes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {agendaItems.map((agenda) => (
                  <button
                    key={agenda.id}
                    onClick={() => setSelectedAgendaId(agenda.id)}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-all',
                      selectedAgendaId === agenda.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                          selectedAgendaId === agenda.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}>
                          {agenda.order}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{agenda.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {getAgendaNotes(agenda.id).length} note{getAgendaNotes(agenda.id).length !== 1 ? 's' : ''}
                            {getAgendaRecos(agenda.id).length > 0 && (
                              <span className="ml-2 text-orange-500">
                                · {getAgendaRecos(agenda.id).length} reco
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        selectedAgendaId === agenda.id && 'text-primary rotate-90',
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Notes Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {selectedAgenda
                ? `${selectedAgenda.order}. ${selectedAgenda.title}`
                : 'Sélectionnez un ordre du jour'}
            </CardTitle>
            {selectedAgenda && (
              <CardDescription>
                {selectedAgenda.notes.length} note{selectedAgenda.notes.length !== 1 ? 's' : ''} pour cet ordre du jour
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedAgenda ? (
              <div className="space-y-4">

                {/* Add Note Form */}
                <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    Nouvelle Note
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {participants.length > 0 ? (
                      <Select value={newSpeaker} onValueChange={setNewSpeaker}>
                        <SelectTrigger className="md:col-span-1">
                          <SelectValue placeholder="Intervenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {participants.map(p => (
                            <SelectItem key={p} value={p}>{p.split(' — ')[0]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Nom de l'intervenant"
                        value={newSpeaker}
                        onChange={e => setNewSpeaker(e.target.value)}
                        className="md:col-span-1"
                      />
                    )}
                    <Textarea
                      placeholder="Ce qui a été dit..."
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="md:col-span-2 min-h-[80px] resize-none"
                    />
                    <div className="flex items-end">
                      <Button
                        onClick={handleAddNote}
                        disabled={!newSpeaker.trim() || !newContent.trim()}
                        className="w-full gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Notes List */}
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3 pr-4">
                    {selectedAgenda.notes.length > 0 ? (
                      selectedAgenda.notes.map(note => (
                        <div key={note.id} className="p-4 bg-card border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{note.speaker}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {note.timestamp.toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {editingNoteId === note.id ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveEdit(selectedAgenda.id, note.id)}
                                  className="h-8 w-8"
                                >
                                  <Save className="w-4 h-4 text-accent" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditNote(note.id, note.content)}
                                  className="h-8 w-8"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReformulateNote(selectedAgenda.id, note.id, note.content)}
                                disabled={isReformulating && reformulatingNoteId === note.id}
                                className="h-8 w-8"
                                title="Reformuler en style PV"
                              >
                                <Sparkles className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteNote(selectedAgenda.id, note.id, note.db_id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {editingNoteId === note.id ? (
                            <Textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="min-h-[80px] resize-none"
                              autoFocus
                            />
                          ) : (
                            <p className="text-sm text-foreground pl-10">{note.content}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center p-12 text-muted-foreground">
                        <div className="text-center">
                          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>Aucune note pour cet ordre du jour</p>
                          <p className="text-sm">Ajoutez des notes ci-dessus</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>Sélectionnez un ordre du jour pour ajouter des notes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Synthesis panel (per selected agenda) ── */}
      {selectedAgenda && selectedAgenda.notes.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Synthèse PV — {selectedAgenda.order}. {selectedAgenda.title}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => handleSynthesizeNotes(selectedAgenda.id)}
                disabled={synthesizingAgendaId === selectedAgenda.id}
                className="gap-2"
              >
                {synthesizingAgendaId === selectedAgenda.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Synthèse en cours…</>
                ) : (
                  <><Sparkles className="w-4 h-4" />{selectedAgenda.reformulatedNotes ? 'Régénérer' : 'Synthétiser les notes'}</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Reformule les {selectedAgenda.notes.length} note{selectedAgenda.notes.length > 1 ? 's' : ''} en paragraphe PV prêt à intégrer
            </p>
          </CardHeader>
          {selectedAgenda.reformulatedNotes && (
            <CardContent>
              <div className="relative">
                <Textarea
                  value={selectedAgenda.reformulatedNotes}
                  onChange={e => updateAgendaItem(selectedAgenda.id, { reformulatedNotes: e.target.value })}
                  className="min-h-[120px] resize-none text-sm font-mono"
                />
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span className="text-xs text-accent font-medium">Synthèse prête — sera intégrée dans le PV final</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-xs"
                    onClick={() => {
                      if (selectedAgenda.db_id) {
                        fetch(`${apiUrl}/api/agenda-items/${selectedAgenda.db_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reformulated_notes: selectedAgenda.reformulatedNotes }),
                        }).catch(() => {});
                      }
                    }}
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Sauvegarder
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Quick Stats (only in Notes panel) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {agendaItems.map(agenda => (
          <div
            key={agenda.id}
            onClick={() => setSelectedAgendaId(agenda.id)}
            className={cn(
              'p-3 rounded-lg border text-center cursor-pointer transition-all',
              agenda.notes.length > 0 ? 'bg-accent/10 border-accent/20' : 'bg-muted/50',
              agenda.reformulatedNotes ? 'border-accent/40' : '',
              selectedAgendaId === agenda.id && 'ring-2 ring-primary',
            )}
          >
            <p className="text-2xl font-bold">{agenda.notes.length}</p>
            <p className="text-xs text-muted-foreground truncate">{agenda.title}</p>
            {agenda.reformulatedNotes && (
              <CheckCircle2 className="w-3 h-3 text-accent mx-auto mt-1" />
            )}
          </div>
        ))}
      </div>
      </div>

      {/* ── Panel: Recommandations ── */}
      <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-6', activePanel !== 'recommendations' && 'hidden')}>

        {/* Agenda List (same as Notes panel) */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Ordres du Jour
            </CardTitle>
            <CardDescription>Sélectionnez pour ajouter une recommandation</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {agendaItems.map((agenda) => (
                  <button
                    key={agenda.id}
                    onClick={() => setSelectedAgendaId(agenda.id)}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-all',
                      selectedAgendaId === agenda.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                          selectedAgendaId === agenda.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}>
                          {agenda.order}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{agenda.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {getAgendaRecos(agenda.id).length} recommandation{getAgendaRecos(agenda.id).length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        selectedAgendaId === agenda.id && 'text-primary rotate-90',
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recommendations Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedAgenda
                    ? `${selectedAgenda.order}. ${selectedAgenda.title}`
                    : 'Sélectionnez un ordre du jour'}
                </CardTitle>
                {selectedAgenda && (
                  <CardDescription>
                    {getAgendaRecos(selectedAgendaId || '').length} recommandation{getAgendaRecos(selectedAgendaId || '').length !== 1 ? 's' : ''} pour cet ordre du jour
                  </CardDescription>
                )}
              </div>
              {allRecommendations.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportRecommendations}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exporter CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedAgenda ? (
              <div className="space-y-4">

                {/* Add Recommendation Form */}
                <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    Nouvelle Recommandation
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {participants.length > 0 ? (
                      <Select value={newRecoSpeaker} onValueChange={setNewRecoSpeaker}>
                        <SelectTrigger className="md:col-span-1">
                          <SelectValue placeholder="Participant" />
                        </SelectTrigger>
                        <SelectContent>
                          {participants.map(p => (
                            <SelectItem key={p} value={p}>{p.split(' — ')[0]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Participant"
                        value={newRecoSpeaker}
                        onChange={e => setNewRecoSpeaker(e.target.value)}
                        className="md:col-span-1"
                      />
                    )}
                    <Textarea
                      placeholder="Contenu de la recommandation..."
                      value={newRecoContent}
                      onChange={e => setNewRecoContent(e.target.value)}
                      className="md:col-span-2 min-h-[80px] resize-none"
                    />
                    <div className="flex items-end">
                      <Button
                        onClick={handleAddRecommendation}
                        disabled={!newRecoSpeaker.trim() || !newRecoContent.trim()}
                        className="w-full gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recommendations List for selected agenda */}
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3 pr-4">
                    {getAgendaRecos(selectedAgendaId || '').length > 0 ? (
                      getAgendaRecos(selectedAgendaId || '').map(r => (
                        <div key={r.id} className="p-4 bg-card border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{r.speaker}</p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {r.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRecommendation(selectedAgenda!.id, r.id, r.db_id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-foreground pl-10">{r.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center p-12 text-muted-foreground">
                        <div className="text-center">
                          <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>Aucune recommandation pour cet ordre du jour</p>
                          <p className="text-sm">Ajoutez une recommandation ci-dessus</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>Sélectionnez un ordre du jour pour ajouter une recommandation</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Navigation ── */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button onClick={handleContinue} className="gap-2">
          Générer le PV Final
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

    </div>
  );
}
