import React, { useState, useEffect } from 'react';
import {
  Search,
  Tv,
  Plus,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { QuickAddEpisodeModal } from './QuickAddEpisodeModal';

interface EpisodeManagerProps {
  initialSelectedAnime?: any | null;
  onSelectAnimeForCMS?: (anime: any) => void;
  showToast: (title: string, desc: string, variant?: 'default' | 'destructive') => void;
}

export function EpisodeManager({
  initialSelectedAnime = null,
  onSelectAnimeForCMS,
  showToast,
}: EpisodeManagerProps) {
  const [animeQuery, setAnimeQuery] = useState('');
  const [isSearchingAnime, setIsSearchingAnime] = useState(false);
  const [animeResults, setAnimeResults] = useState<any[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<any | null>(initialSelectedAnime);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const [zokoFrom, setZokoFrom] = useState(1);
  const [zokoTo, setZokoTo] = useState(12);
  const [zokoTracks, setZokoTracks] = useState<{ sub: boolean; dub: boolean; hsub: boolean }>({
    sub: true,
    dub: false,
    hsub: false,
  });
  const [zokoOverwrite, setZokoOverwrite] = useState(false);
  const [isImportingZoko, setIsImportingZoko] = useState(false);

  useEffect(() => {
    if (initialSelectedAnime) {
      setSelectedAnime(initialSelectedAnime);
      loadEpisodesForAnime(initialSelectedAnime);
    } else {
      handleSearchAnime('');
    }
  }, [initialSelectedAnime]);

  const handleSearchAnime = async (queryText: string) => {
    setIsSearchingAnime(true);
    try {
      const results = await api.searchAdminAnime(queryText);
      setAnimeResults(results || []);
    } catch (err: any) {
      showToast('Search Failed', err.message || 'Failed to search anime.', 'destructive');
    } finally {
      setIsSearchingAnime(false);
    }
  };

  useEffect(() => {
    if (!selectedAnime) {
      const timer = setTimeout(() => handleSearchAnime(animeQuery), 350);
      return () => clearTimeout(timer);
    }
  }, [animeQuery, selectedAnime]);

  const loadEpisodesForAnime = async (anime: any) => {
    setIsLoadingEpisodes(true);
    try {
      const res = await api.getAdminAnimeWithEpisodes(anime.id || anime.external_id);
      setSelectedAnime(res.anime || anime);
      setEpisodes(res.episodes || []);
    } catch (err: any) {
      showToast('Failed to Load Episodes', err.message || 'Could not fetch episodes.', 'destructive');
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const handleZokoImport = async () => {
    if (!selectedAnime?.external_id) {
      showToast('Missing MAL ID', 'This anime has no external_id (MAL ID).', 'destructive');
      return;
    }
    const from = Number(zokoFrom);
    const to = Number(zokoTo);
    if (!from || !to || from < 1 || to < from) {
      showToast('Invalid range', 'Set a valid From / To episode range.', 'destructive');
      return;
    }
    if (to - from > 500) {
      showToast('Range too large', 'Import at most 500 episodes at a time.', 'destructive');
      return;
    }
    const tracks: Array<'sub' | 'dub' | 'hsub'> = [];
    if (zokoTracks.sub) tracks.push('sub');
    if (zokoTracks.dub) tracks.push('dub');
    if (zokoTracks.hsub) tracks.push('hsub');
    if (tracks.length === 0) {
      showToast('Select track', 'Pick at least one of SUB / DUB / Hard-Sub.', 'destructive');
      return;
    }

    setIsImportingZoko(true);
    try {
      const res = await api.importZokoEpisodes({
        anime_mal_id: Number(selectedAnime.external_id),
        from_episode: from,
        to_episode: to,
        tracks,
        overwrite: zokoOverwrite,
      });
      showToast(
        'ZokoAnime Import Done',
        `Created ${res.episodes_created}, updated ${res.episodes_updated}, servers +${res.servers_added}`
      );
      loadEpisodesForAnime(selectedAnime);
    } catch (err: any) {
      showToast('Import Failed', err.message || 'Could not import from ZokoAnime.', 'destructive');
    } finally {
      setIsImportingZoko(false);
    }
  };

  if (!selectedAnime) {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-[#0a0a14] p-5 space-y-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tv className="h-5 w-5 text-rose-500" /> Episode Management — Select Anime
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search anime by title..."
              value={animeQuery}
              onChange={(e) => setAnimeQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#08080c] py-3.5 pl-12 pr-4 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {animeResults.map((anime) => (
            <button
              key={anime.id || anime.external_id}
              onClick={() => {
                setSelectedAnime(anime);
                loadEpisodesForAnime(anime);
              }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a14] p-3.5 text-left hover:border-rose-500/50 transition-all"
            >
              <img
                src={anime.cover_url || ''}
                alt={anime.title}
                className="h-16 w-12 object-cover rounded-lg border border-white/10"
              />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{anime.title}</div>
                <div className="text-xs text-slate-400">MAL #{anime.external_id}</div>
              </div>
            </button>
          ))}
        </div>
        {isSearchingAnime && <div className="text-center text-xs text-slate-400">Searching...</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#0c0c16] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={selectedAnime.cover_url || ''}
              alt={selectedAnime.title}
              className="h-20 w-16 shrink-0 rounded-2xl object-cover border border-white/10"
            />
            <div>
              <button
                onClick={() => setSelectedAnime(null)}
                className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Search
              </button>
              <h2 className="text-xl font-black text-white mt-1">{selectedAnime.title}</h2>
              <div className="text-xs text-slate-400 mt-1">
                MAL ID: #{selectedAnime.external_id} · {episodes.length} Episodes
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Episode</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">Import from ZokoAnime</span>
        </div>
        <p className="text-xs text-slate-400">
          Creates episodes + ZokoAnime embed servers for MAL #{selectedAnime.external_id}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From</label>
            <input
              type="number"
              min={1}
              value={zokoFrom}
              onChange={(e) => setZokoFrom(parseInt(e.target.value, 10) || 1)}
              className="w-20 rounded-xl border border-white/10 bg-[#08080c] px-2.5 py-2 text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To</label>
            <input
              type="number"
              min={1}
              value={zokoTo}
              onChange={(e) => setZokoTo(parseInt(e.target.value, 10) || 1)}
              className="w-20 rounded-xl border border-white/10 bg-[#08080c] px-2.5 py-2 text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer pb-2">
            <input type="checkbox" checked={zokoTracks.sub} onChange={(e) => setZokoTracks((t) => ({ ...t, sub: e.target.checked }))} />
            SUB
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer pb-2">
            <input type="checkbox" checked={zokoTracks.dub} onChange={(e) => setZokoTracks((t) => ({ ...t, dub: e.target.checked }))} />
            DUB
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer pb-2">
            <input type="checkbox" checked={zokoTracks.hsub} onChange={(e) => setZokoTracks((t) => ({ ...t, hsub: e.target.checked }))} />
            Hard-Sub
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 cursor-pointer pb-2">
            <input type="checkbox" checked={zokoOverwrite} onChange={(e) => setZokoOverwrite(e.target.checked)} />
            Overwrite Zoko servers
          </label>
          <button
            type="button"
            onClick={handleZokoImport}
            disabled={isImportingZoko}
            className="ml-auto flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {isImportingZoko ? 'Importing…' : 'Import Episodes'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{episodes.length} episodes loaded</span>
        <button
          onClick={() => loadEpisodesForAnime(selectedAnime)}
          className="flex items-center gap-1.5 rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingEpisodes ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoadingEpisodes ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-slate-900/60 animate-pulse" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-800 p-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-600 mb-2" />
          <h3 className="text-base font-bold text-white">No episodes yet</h3>
          <p className="text-xs text-slate-400 mt-1">Use ZokoAnime import or + Add Episode above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep: any) => (
            <div key={ep.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0a0a14] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 font-black text-sm">
                  {ep.episode_number}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{ep.title || `Episode ${ep.episode_number}`}</div>
                  <div className="text-[11px] text-slate-400">
                    SUB: {ep.sub_count ?? (ep.sub || []).length} · DUB: {ep.dub_count ?? (ep.dub || []).length}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuickAddEpisodeModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        anime={selectedAnime}
        initialEpisodeNumber={(episodes[episodes.length - 1]?.episode_number || 0) + 1}
        onSuccess={() => {
          showToast('Episode Added', 'Episode created successfully.');
          loadEpisodesForAnime(selectedAnime);
        }}
      />
    </div>
  );
}
