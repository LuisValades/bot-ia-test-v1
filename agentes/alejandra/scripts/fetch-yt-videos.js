import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHANNEL_URL = process.argv[2] || process.env.YOUTUBE_CHANNEL_URL || 'https://www.youtube.com/@luisvaladesbroker';
const API_KEY = process.env.YOUTUBE_API_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url.split('?')[0]} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-MX,es;q=0.9' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

async function resolveChannelId(channelUrl) {
  if (process.env.YOUTUBE_CHANNEL_ID) return process.env.YOUTUBE_CHANNEL_ID;
  console.log(`[yt] resolviendo channelId desde HTML…`);
  const html = await fetchText(channelUrl);
  const m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/) || html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/);
  if (!m) throw new Error('No pude extraer channelId');
  return m[1];
}

async function getUploadsPlaylistId(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=contentDetails,snippet,statistics&key=${API_KEY}`;
  const data = await fetchJson(url);
  const item = data.items?.[0];
  if (!item) throw new Error(`Canal ${channelId} no encontrado`);
  return {
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    channelTitle: item.snippet.title,
    channelDescription: item.snippet.description,
    subscriberCount: item.statistics.subscriberCount,
    videoCount: item.statistics.videoCount
  };
}

async function fetchAllPlaylistItems(playlistId) {
  const all = [];
  let pageToken = '';
  let page = 0;
  while (true) {
    page++;
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${playlistId}&part=snippet,contentDetails&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`;
    const data = await fetchJson(url);
    const items = data.items || [];
    all.push(...items);
    process.stdout.write(`\r[yt] página ${page} — acumulado ${all.length} videos`);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  console.log('');
  return all;
}

async function fetchVideosDetails(videoIds) {
  const all = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${batch.join(',')}&part=snippet,contentDetails,statistics&key=${API_KEY}`;
    const data = await fetchJson(url);
    all.push(...(data.items || []));
  }
  return all;
}

function parseISODuration(iso) {
  // PT1H2M30S → "1:02:30"; PT5M30S → "5:30"; PT45S → "0:45"
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return '';
  const [_, h, mi, s] = m;
  const H = h ? parseInt(h, 10) : 0;
  const M = mi ? parseInt(mi, 10) : 0;
  const S = s ? parseInt(s, 10) : 0;
  if (H > 0) return `${H}:${String(M).padStart(2, '0')}:${String(S).padStart(2, '0')}`;
  return `${M}:${String(S).padStart(2, '0')}`;
}

async function main() {
  if (!API_KEY) throw new Error('YOUTUBE_API_KEY no configurada en .env');

  console.log(`[yt] canal: ${CHANNEL_URL}`);
  const channelId = await resolveChannelId(CHANNEL_URL);
  console.log(`[yt] channelId: ${channelId}`);

  const channelInfo = await getUploadsPlaylistId(channelId);
  console.log(`[yt] ${channelInfo.channelTitle} · ${channelInfo.videoCount} videos · ${channelInfo.subscriberCount} subs`);
  console.log(`[yt] uploads playlist: ${channelInfo.uploadsPlaylistId}`);

  const items = await fetchAllPlaylistItems(channelInfo.uploadsPlaylistId);
  const videoIds = items.map(i => i.contentDetails.videoId);

  console.log(`[yt] trayendo detalles de ${videoIds.length} videos…`);
  const details = await fetchVideosDetails(videoIds);
  const byId = new Map(details.map(v => [v.id, v]));

  const videos = items.map(it => {
    const d = byId.get(it.contentDetails.videoId);
    return {
      videoId: it.contentDetails.videoId,
      title: it.snippet.title,
      description: (it.snippet.description || '').slice(0, 500),
      publishedAt: it.contentDetails.videoPublishedAt || it.snippet.publishedAt,
      duration: d ? parseISODuration(d.contentDetails.duration) : '',
      durationISO: d?.contentDetails?.duration || '',
      viewCount: d?.statistics?.viewCount || null,
      likeCount: d?.statistics?.likeCount || null,
      thumbnail: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url || '',
      url: `https://www.youtube.com/watch?v=${it.contentDetails.videoId}`
    };
  });

  // Ordenar por fecha descendente
  videos.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(__dirname);
  const outFile = path.join(outDir, `yt-videos-${stamp}.json`);
  const mdFile = path.join(outDir, `yt-videos-${stamp}.md`);

  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        channelUrl: CHANNEL_URL,
        channelId,
        channelTitle: channelInfo.channelTitle,
        channelDescription: channelInfo.channelDescription,
        subscriberCount: channelInfo.subscriberCount,
        videoCountFromChannel: channelInfo.videoCount,
        videoCountFetched: videos.length,
        fetchedAt: new Date().toISOString(),
        videos
      },
      null,
      2
    ),
    'utf8'
  );

  const md = [
    `# Videos del canal ${channelInfo.channelTitle}`,
    `**Canal:** ${CHANNEL_URL}`,
    `**Channel ID:** ${channelId}`,
    `**Suscriptores:** ${Number(channelInfo.subscriberCount).toLocaleString('es-MX')}`,
    `**Videos totales:** ${channelInfo.videoCount} · **Fetched:** ${videos.length}`,
    `**Extraído:** ${new Date().toLocaleString('es-MX')}`,
    '',
    '| # | Título | Duración | Publicado | Views | URL |',
    '|---|---|---|---|---|---|',
    ...videos.map((v, i) => {
      const t = (v.title || '').replace(/\|/g, '\\|').slice(0, 90);
      const pub = (v.publishedAt || '').slice(0, 10);
      const views = v.viewCount ? Number(v.viewCount).toLocaleString('es-MX') : '—';
      return `| ${i + 1} | ${t} | ${v.duration} | ${pub} | ${views} | [ver](${v.url}) |`;
    })
  ].join('\n');
  await fs.writeFile(mdFile, md, 'utf8');

  console.log(`\n✅ ${videos.length} videos guardados en:`);
  console.log(`   ${outFile}`);
  console.log(`   ${mdFile}`);
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
