'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { getApiBaseUrl } from '@/lib/pptx-import';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  RefreshCw,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Activity,
  BarChart2,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const STATUS_BAR: Record<string, string> = {
  uploaded: '#378ADD',
  parsed: '#E6A817',
  agenda_analyzed: '#E8742C',
  draft_generated: '#7E57C2',
  pv_final_generated: '#2E7D32',
  pv_final_translated: '#00695C',
  validated: '#3B9C4A',
  translated: '#1D9E8C',
  exported: '#888780',
};

interface SessionSummary {
  id: number;
  filename: string;
  status: string;
  nb_slides: number;
  nb_graphiques_natifs: number;
  created_at: string | null;
  updated_at: string | null;
}

const FINISHED_STATUSES = ['pv_final_generated', 'pv_final_translated', 'validated', 'translated', 'exported'];

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Upload',
  parsed: 'Slides extraites',
  agenda_analyzed: 'Agenda analysé',
  draft_generated: 'Draft généré',
  pv_final_generated: 'PV final généré',
  pv_final_translated: 'PV final traduit',
  validated: 'Validé',
  translated: 'Traduit',
  exported: 'Exporté',
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-blue-100 text-blue-800',
  parsed: 'bg-yellow-100 text-yellow-800',
  agenda_analyzed: 'bg-orange-100 text-orange-800',
  draft_generated: 'bg-purple-100 text-purple-800',
  pv_final_generated: 'bg-green-100 text-green-800',
  pv_final_translated: 'bg-teal-100 text-teal-800',
  validated: 'bg-green-100 text-green-800',
  translated: 'bg-teal-100 text-teal-800',
  exported: 'bg-gray-100 text-gray-800',
};

type ViewFilter = 'all' | 'active' | 'finished';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffSec < 60) return 'il y a quelques secondes';
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return 'il y a 1 jour';
  return `il y a ${diffD} jours`;
}

function truncateFilename(filename: string, maxLen = 30): string {
  if (filename.length <= maxLen) return filename;
  const ext = filename.lastIndexOf('.');
  if (ext > 0) {
    const name = filename.slice(0, ext);
    const extension = filename.slice(ext);
    return name.slice(0, maxLen - extension.length - 3) + '...' + extension;
  }
  return filename.slice(0, maxLen - 3) + '...';
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}) {
  return (
    <Card className="relative overflow-hidden border">
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
        style={{ background: accent }}
      />
      <CardContent className="pl-5 pr-4 py-4 flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: SessionSummary;
  actionLabel: string;
  onAction: (id: number) => void;
  onDelete: (id: number) => void;
  deleting?: boolean;
}

function SessionCard({ session, actionLabel, onAction, onDelete, deleting }: SessionCardProps) {
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;
  const statusColor = STATUS_COLORS[session.status] ?? 'bg-gray-100 text-gray-800';
  const barColor = STATUS_BAR[session.status] ?? '#888780';

  return (
    <Card
      className="flex flex-col hover:shadow-md transition-shadow duration-200 border border-border overflow-hidden"
      style={{ borderTop: `3px solid ${barColor}` }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#1B5E9B] flex-shrink-0" />
            <CardTitle className="text-sm font-semibold truncate" title={session.filename}>
              {truncateFilename(session.filename)}
            </CardTitle>
          </div>

          {/* Delete button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={deleting}
                className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                aria-label="Supprimer la session"
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
                <AlertDialogDescription>
                  La session <strong className="text-foreground">{session.filename}</strong> et toutes ses données
                  (slides, graphiques, tableaux, PV, traductions) seront supprimées définitivement.
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(session.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <span className={`inline-block self-start text-xs font-medium px-2 py-0.5 rounded-md mt-2 ${statusColor}`}>
          {statusLabel}
        </span>
        <CardDescription className="flex items-center gap-1 text-xs mt-2">
          <Clock className="w-3 h-3" />
          {timeAgo(session.updated_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="w-3.5 h-3.5" />
            <span>{session.nb_slides} slides</span>
          </div>
          <Button
            size="sm"
            variant={actionLabel === 'Reprendre' ? 'default' : 'outline'}
            className="h-7 text-xs gap-1"
            onClick={() => onAction(session.id)}
          >
            {actionLabel}
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function SessionsDashboard() {
  const { resetWorkflow, setCurrentStep, loadSession } = useWorkflow();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SessionSummary[] = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('SessionsDashboard: fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNew = useCallback(() => {
    resetWorkflow();
    setCurrentStep('upload');
  }, [resetWorkflow, setCurrentStep]);

  const handleResume = useCallback(
    async (id: number) => {
      await loadSession(id);
    },
    [loadSession],
  );

  const handleDelete = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Erreur suppression session', err);
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── KPIs ──
  const totalSlides = sessions.reduce((acc, s) => acc + (s.nb_slides || 0), 0);
  const activeSessions = sessions.filter(s => !FINISHED_STATUSES.includes(s.status));
  const finishedSessions = sessions.filter(s => FINISHED_STATUSES.includes(s.status));

  // ── Filtered sessions ──
  const filtered = useMemo(() => {
    let list = sessions;

    if (viewFilter === 'active') list = list.filter(s => !FINISHED_STATUSES.includes(s.status));
    if (viewFilter === 'finished') list = list.filter(s => FINISHED_STATUSES.includes(s.status));
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    if (search.trim())
      list = list.filter(s =>
        s.filename.toLowerCase().includes(search.trim().toLowerCase()),
      );

    return list;
  }, [sessions, viewFilter, statusFilter, search]);

  const filteredActive = filtered.filter(s => !FINISHED_STATUSES.includes(s.status));
  const filteredFinished = filtered.filter(s => FINISHED_STATUSES.includes(s.status));

  const hasFilters = !!search || !!statusFilter || viewFilter !== 'all';

  // ── Status options for the filter ──
  const statusOptions = useMemo(() => {
    const seen = new Set(sessions.map(s => s.status));
    return Object.entries(STATUS_LABELS).filter(([k]) => seen.has(k));
  }, [sessions]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos sessions de génération de procès-verbaux
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
          <Button size="sm" onClick={handleNew} className="gap-1">
            <Plus className="w-4 h-4" />
            Nouvelle Session
          </Button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total sessions"
          value={sessions.length}
          icon={<FileText className="w-5 h-5" />}
          accent="#1B5E9B"
        />
        <KpiCard
          label="En cours"
          value={activeSessions.length}
          icon={<Activity className="w-5 h-5" />}
          accent="#E8742C"
          sub={sessions.length > 0 ? `${Math.round((activeSessions.length / sessions.length) * 100)}% du total` : undefined}
        />
        <KpiCard
          label="Terminées"
          value={finishedSessions.length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="#3B9C4A"
          sub={sessions.length > 0 ? `${Math.round((finishedSessions.length / sessions.length) * 100)}% du total` : undefined}
        />
        <KpiCard
          label="Slides traitées"
          value={totalSlides}
          icon={<BarChart2 className="w-5 h-5" />}
          accent="#7E57C2"
          sub={sessions.length > 0 ? `moy. ${Math.round(totalSlides / sessions.length)}/session` : undefined}
        />
      </div>

      {/* ── Filter bar ── */}
      {!loading && sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 border rounded-xl">
          {/* Search */}
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom de fichier…"
              className="pl-8 h-8 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-background border rounded-lg overflow-hidden text-xs divide-x">
            {([
              { val: 'all', label: 'Toutes' },
              { val: 'active', label: 'En cours' },
              { val: 'finished', label: 'Terminées' },
            ] as { val: ViewFilter; label: string }[]).map(opt => (
              <button
                key={opt.val}
                onClick={() => setViewFilter(opt.val)}
                className={`px-3 py-1.5 transition-colors ${
                  viewFilter === opt.val
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/25"
          >
            <option value="">Tous les statuts</option>
            {statusOptions.map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>

          {/* Reset filters */}
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setViewFilter('all'); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && (
        <>
          {/* Résultat filtré vide */}
          {filtered.length === 0 && hasFilters && (
            <Card className="border-dashed">
              <CardContent className="p-0">
                <EmptyState message="Aucune session ne correspond aux filtres sélectionnés." />
              </CardContent>
            </Card>
          )}

          {/* ── Sessions en cours ── */}
          {(viewFilter !== 'finished') && (filteredActive.length > 0 || !hasFilters) && (
            <section>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                Sessions en cours
                {filteredActive.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredActive.length}
                  </Badge>
                )}
              </h2>
              {filteredActive.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-0">
                    <EmptyState message="Aucune session en cours. Créez une nouvelle session pour commencer." />
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                    {filteredActive.map(session => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        actionLabel="Reprendre"
                        onAction={handleResume}
                        onDelete={handleDelete}
                        deleting={deletingId === session.id}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </section>
          )}

          {/* ── Sessions terminées ── */}
          {(viewFilter !== 'active') && (filteredFinished.length > 0 || !hasFilters) && (
            <section>
              <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Sessions terminées
                {filteredFinished.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredFinished.length}
                  </Badge>
                )}
              </h2>
              {filteredFinished.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-0">
                    <EmptyState message="Aucune session terminée pour le moment." />
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                    {filteredFinished.map(session => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        actionLabel="Voir"
                        onAction={handleResume}
                        onDelete={handleDelete}
                        deleting={deletingId === session.id}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
