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
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeetingNotesStep() {
  const [isReformulating, setIsReformulating] = useState(false);
const [reformulatingNoteId, setReformulatingNoteId] = useState<string | null>(null);

  const { agendaItems, addMeetingNote, updateMeetingNote, deleteMeetingNote, setCurrentStep, document } = useWorkflow();
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaItems[0]?.id || null);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [newContent, setNewContent] = useState('');
  const participants = document?.participants || [];
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newRecoSpeaker, setNewRecoSpeaker] = useState('');
  const [newRecoContent, setNewRecoContent] = useState('');
  const [recommendations, setRecommendations] = useState<{
    id: string;
    agendaId: string;
    agendaTitle: string;
    speaker: string;
    content: string;
    timestamp: Date;
  }[]>([]);
  const selectedAgenda = agendaItems.find(a => a.id === selectedAgendaId);
const handleAddRecommendation = () => {
  if (!selectedAgendaId || !newRecoSpeaker.trim() || !newRecoContent.trim()) return;
  setRecommendations(prev => [...prev, {
    id: `reco-${Date.now()}`,
    agendaId: selectedAgendaId,
    agendaTitle: selectedAgenda?.title || '',
    speaker: newRecoSpeaker.trim(),
    content: newRecoContent.trim(),
    timestamp: new Date(),
  }]);
  setNewRecoSpeaker('');
  setNewRecoContent('');
};

const handleExportExcel = () => {
  if (recommendations.length === 0) return;

  const headers = ['Ordre du Jour', 'Participant', 'Recommandation', 'Heure'];
  const rows = recommendations.map(r => [
    r.agendaTitle,
    r.speaker,
    r.content,
    r.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `Recommandations_${new Date().toISOString().split('T')[0]}.csv`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
  const handleAddNote = () => {
    if (!selectedAgendaId || !newSpeaker.trim() || !newContent.trim()) return;

    addMeetingNote(selectedAgendaId, {
      speaker: newSpeaker.trim(),
      content: newContent.trim(),
      timestamp: new Date()
    });

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
  const reformulateForPV = async (text: string) => {
    const prompt = `
  Reformule cette note en français professionnel, clair et adapté à un procès-verbal de réunion.
  Garde le sens original, corrige les fautes, complète les formulations maladroites si nécessaire.
  Retourne uniquement la phrase reformulée.

  Note: ${text}
  `;

  const response = await fetch('/api/reformulate-note', {
  method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error('Erreur de reformulation');
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
  const data = await response.json();
  return data.text;
};
  const handleDeleteNote = (agendaId: string, noteId: string) => {
    deleteMeetingNote(agendaId, noteId);
  };

  const totalNotes = agendaItems.reduce((acc, a) => acc + a.notes.length, 0);

  const handleContinue = () => {
    setCurrentStep('final-pv');
  };

  const handleBack = () => {
    setCurrentStep('draft-generation');
  };

  function handleReformulateNote(id: string, id1: string, content: string): void {
    throw new Error('Function not implemented.');
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Status Banner */}
      <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-warning animate-pulse" />
        <div>
          <p className="font-medium text-warning-foreground">Réunion en cours</p>
          <p className="text-sm text-muted-foreground">
            Prenez les notes de chaque intervenant par ordre du jour • {totalNotes} note{totalNotes > 1 ? 's' : ''} enregistrée{totalNotes > 1 ? 's' : ''}
          </p>
        </div>
      </div>

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
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                          selectedAgendaId === agenda.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {agenda.order}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{agenda.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {agenda.notes.length} note{agenda.notes.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        selectedAgendaId === agenda.id && 'text-primary rotate-90'
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
              {selectedAgenda ? `${selectedAgenda.order}. ${selectedAgenda.title}` : 'Sélectionnez un ordre du jour'}
            </CardTitle>
            {selectedAgenda && (
              <CardDescription>
                {selectedAgenda.notes.length} note{selectedAgenda.notes.length > 1 ? 's' : ''} pour cet ordre du jour
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
                      <Select
                        value={newSpeaker}
                        onValueChange={(value) => setNewSpeaker(value)}
                        className="md:col-span-1"
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir un participant" />
                        </SelectTrigger>
                        <SelectContent>
                          {participants.map((participant) => (
                            <SelectItem key={participant} value={participant}>
                              {participant}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Nom de l'intervenant"
                        value={newSpeaker}
                        onChange={(e) => setNewSpeaker(e.target.value)}
                        className="md:col-span-1"
                      />
                    )}
                    <Textarea
                      placeholder="Ce qui a été dit..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="md:col-span-2 min-h-[80px] resize-none"
                    />
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddNote}
                        disabled={!newSpeaker.trim() || !newContent.trim()}
                        className="w-full gap-2"
                      >
                        <Plus className="flex items-end" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>
                {/* Recommandations */}
<div className="border-t pt-4">
  <p className="text-sm font-medium flex items-center gap-2 mb-3">
    <Plus className="flex items-end" />
    Recommandations
    <span className="text-xs text-muted-foreground font-normal">(export Excel séparé)</span>
  </p>

  <div className="p-4 bg-muted/30 rounded-lg border border-dashed space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {participants.length > 0 ? (
        <Select value={newRecoSpeaker} onValueChange={setNewRecoSpeaker}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Participant" />
          </SelectTrigger>
          <SelectContent>
            {participants.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          placeholder="Participant"
          value={newRecoSpeaker}
          onChange={(e) => setNewRecoSpeaker(e.target.value)}
        />
      )}
      <Textarea
        placeholder="Recommandation..."
        value={newRecoContent}
        onChange={(e) => setNewRecoContent(e.target.value)}
        className="md:col-span-2 min-h-[80px] resize-none"
      />
      <div className="flex items-end">
        <Button
          onClick={handleAddRecommendation}
          disabled={!newRecoSpeaker.trim() || !newRecoContent.trim()}
          className="w-full gap-2"
        >
          <Plus className="flex items-end" />
          Ajouter
        </Button>
      </div>
    </div>

    {recommendations.filter(r => r.agendaId === selectedAgendaId).length > 0 && (
      <div className="space-y-2 mt-2">
        {recommendations
          .filter(r => r.agendaId === selectedAgendaId)
          .map(r => (
            <div key={r.id} className="flex items-start justify-between p-3 bg-white rounded border border-orange-100">
              <div>
                <p className="text-sm font-medium">{r.speaker}</p>
                <p className="text-sm text-muted-foreground">{r.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRecommendations(prev => prev.filter(x => x.id !== r.id))}
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
      </div>
    )}
  </div>
</div>
                {/* Notes List */}
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3 pr-4">
                    {selectedAgenda.notes.length > 0 ? (
                      selectedAgenda.notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 bg-card border rounded-lg space-y-2"
                        >
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
                                    minute: '2-digit' 
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
                                title="Reformuler pour une phrase professionnelle de PV"
                              >
                                <Sparkles className="w-4 h-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteNote(selectedAgenda.id, note.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {editingNoteId === note.id ? (
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
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

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {agendaItems.map((agenda) => (
          <div
            key={agenda.id}
            className={cn(
              'p-3 rounded-lg border text-center cursor-pointer transition-all',
              agenda.notes.length > 0 ? 'bg-accent/10 border-accent/20' : 'bg-muted/50',
              selectedAgendaId === agenda.id && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedAgendaId(agenda.id)}
          >
            <p className="text-2xl font-bold">{agenda.notes.length}</p>
            <p className="text-xs text-muted-foreground truncate">{agenda.title}</p>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
  <Button variant="outline" onClick={handleBack} className="gap-2">
    <ArrowLeft className="w-4 h-4" />
    Retour
  </Button>

  <div className="flex gap-2">
    {recommendations.length > 0 && (
      <Button
        variant="outline"
        onClick={handleExportExcel}
        className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
      >
        <Download className="w-4 h-4" />
        Exporter Recommandations ({recommendations.length})
      </Button>
    )}
    <Button onClick={handleContinue} className="gap-2" disabled={totalNotes === 0}>
      Générer le PV Final
      <ArrowRight className="w-4 h-4" />
    </Button>
  </div>
</div>
    </div>
  );
}
