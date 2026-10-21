import type { Express } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { requireAdmin } from './auth.js';

/** Register ZokoAnime bulk episode import admin route */
export function registerZokoImport(app: Express) {
app.post('/api/admin/episodes/import-zoko', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const db = req.supabase;
    if (!db) {
      return res.status(503).json({ error: 'Database client is not available.' });
    }

    const {
      anime_mal_id,
      from_episode = 1,
      to_episode,
      tracks = ['sub'],
      color = '35d5bf',
      overwrite = false,
    } = req.body || {};

    const malId = Number(anime_mal_id);
    const from = Number(from_episode);
    // Allow single-episode import: if to_episode is omitted/invalid, default to from
    let to = to_episode === undefined || to_episode === null || to_episode === ''
      ? from
      : Number(to_episode);
    if (isNaN(to) || to < from) {
      to = from;
    }

    if (!malId || isNaN(malId) || malId <= 0) {
      return res.status(400).json({ error: 'Valid anime_mal_id (MAL ID) is required.' });
    }
    if (!from || isNaN(from) || from < 1) {
      return res.status(400).json({ error: 'from_episode must be a number >= 1.' });
    }
    // Single episode is allowed when from === to
    if (to < from) {
      return res.status(400).json({ error: 'to_episode must be >= from_episode (use same number for a single episode).' });
    }
    if (to - from > 500) {
      return res.status(400).json({ error: 'Maximum 500 episodes per import request.' });
    }

    const allowedTracks = new Set(['sub', 'dub', 'hsub']);
    const trackList: string[] = (Array.isArray(tracks) ? tracks : [tracks])
      .map((t: any) => String(t || '').toLowerCase().trim())
      .filter((t: string) => allowedTracks.has(t));

    if (trackList.length === 0) {
      return res.status(400).json({ error: 'tracks must include at least one of: sub, dub, hsub.' });
    }

    const accent = String(color || '35d5bf').replace(/[^0-9a-fA-F]/g, '').slice(0, 6) || '35d5bf';

    const { data: animeRow, error: animeErr } = await db
      .from('anime')
      .select('id, external_id, title, cover_url')
      .eq('external_id', malId)
      .maybeSingle();

    if (animeErr) {
      throw new Error('Failed to look up anime: ' + animeErr.message);
    }
    if (!animeRow) {
      return res.status(404).json({
        error: 'Anime not found in database. Add the anime in Anime CMS first (MAL ID must match).',
      });
    }

    let episodesCreated = 0;
    let episodesUpdated = 0;
    let serversAdded = 0;
    const errors: string[] = [];

    for (let ep = from; ep <= to; ep++) {
      try {
        const { data: existingEp } = await db
          .from('episodes')
          .select('id, title, thumbnail_url')
          .eq('anime_mal_id', malId)
          .eq('episode_number', ep)
          .maybeSingle();

        const payload: Record<string, any> = {
          anime_id: animeRow.id,
          anime_mal_id: malId,
          episode_number: ep,
          updated_at: new Date().toISOString(),
        };

        if (!existingEp) {
          payload.title = `Episode ${ep}`;
          payload.thumbnail_url = animeRow.cover_url || null;
        } else {
          // Keep existing title/thumbnail on update
          payload.title = existingEp.title || `Episode ${ep}`;
          if (existingEp.thumbnail_url) payload.thumbnail_url = existingEp.thumbnail_url;
        }

        const { data: episodeRecord, error: epErr } = await db
          .from('episodes')
          .upsert(payload, { onConflict: 'anime_mal_id,episode_number' })
          .select()
          .single();

        if (epErr || !episodeRecord) {
          errors.push(`Episode ${ep}: ${epErr?.message || 'save failed'}`);
          continue;
        }

        if (existingEp) episodesUpdated++;
        else episodesCreated++;

        if (overwrite) {
          const { data: existingServers } = await db
            .from('episode_servers')
            .select('id, server_name')
            .eq('episode_id', episodeRecord.id);

          const zokoIds = (existingServers || [])
            .filter((s: any) => {
              const name = String(s.server_name || '').toLowerCase();
              return (
                name.includes('zokoanime') ||
                name === 'sub' ||
                name === 'dub' ||
                name === 'hard-sub' ||
                name === 'player 1' ||
                name === 'hd-1' ||
                name === 'server a'
              );
            })
            .map((s: any) => s.id);

          if (zokoIds.length > 0) {
            await db.from('episode_servers').delete().in('id', zokoIds);
          }
        }

        const toInsert: Array<{
          episode_id: string;
          language: 'sub' | 'dub';
          server_name: string;
          embed_url: string;
        }> = [];

        for (const track of trackList) {
          const language: 'sub' | 'dub' = track === 'dub' ? 'dub' : 'sub';
          const serverName =
            track === 'hsub'
              ? 'Server A'
              : track === 'dub'
                ? 'HD-1'
                : 'Player 1';
          const embed_url = `https://zokoanime.video/stream/mal/${malId}/${ep}/${track}?color=${accent}&autonext=1`;

          if (!overwrite) {
            const { data: existingServer } = await db
              .from('episode_servers')
              .select('id')
              .eq('episode_id', episodeRecord.id)
              .eq('language', language)
              .eq('server_name', serverName)
              .maybeSingle();
            if (existingServer) continue;
          }

          toInsert.push({
            episode_id: episodeRecord.id,
            language,
            server_name: serverName,
            embed_url,
          });
        }

        if (toInsert.length > 0) {
          const { error: sErr } = await db.from('episode_servers').insert(toInsert);
          if (sErr) {
            errors.push(`Episode ${ep} servers: ${sErr.message}`);
          } else {
            serversAdded += toInsert.length;
          }
        }
      } catch (inner: any) {
        errors.push(`Episode ${ep}: ${inner?.message || 'unknown error'}`);
      }
    }

    res.json({
      success: true,
      anime_mal_id: malId,
      from_episode: from,
      to_episode: to,
      tracks: trackList,
      episodes_created: episodesCreated,
      episodes_updated: episodesUpdated,
      servers_added: serversAdded,
      errors: errors.length ? errors.slice(0, 20) : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'ZokoAnime import failed.' });
  }
});
}
