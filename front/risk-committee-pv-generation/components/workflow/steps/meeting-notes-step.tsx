'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Plus, 
  Trash2,
  ArrowRight, 
  ArrowLeft,
  User,
  Clock,
  Edit3,
  Save,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeetingNotesStep() {
  const { agendaItems, addMeetingNote, updateMeetingNote, deleteMeetingNote, setCurrentStep } = useWorkflow();
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaItems[0]?.id || null);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const selectedAgenda = agendaItems.find(a => a.id === selectedAgendaId);

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
                    <Input
                      placeholder="Nom de l'intervenant"
                      value={newSpeaker}
                      onChange={(e) => setNewSpeaker(e.target.value)}
                      className="md:col-span-1"
                    />
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
        <Button 
          onClick={handleContinue} 
          className="gap-2"
          disabled={totalNotes === 0}
        >
          Générer le PV Final
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
