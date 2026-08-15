import express from 'express';
import cors from 'cors';
import { multiProvider } from './providers/reanime.js';
import { getAnikotoStream, getAnilistId } from './providers/anikoto-wrapper.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ping route for Uptime Bot
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Render production health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'aniwavex-backend'
  });
});

// Stream fetching route
app.get('/stream', async (req, res) => {
  const id = req.query.id as string;
  const ep = req.query.ep as string;
  const title = req.query.title as string;
  const audio = (req.query.audio as string) || 'sub';

  if (!id || !ep || !title) {
    return res.status(400).json({ error: "Missing required parameters (id, ep, title)" });
  }

  try {
    // 1. Try to fetch from AnikotoProvider
    const anikotoRes = await getAnikotoStream(title, parseInt(ep, 10), audio as 'sub' | 'dub');
    
    if (anikotoRes && anikotoRes.streams) {
      const embedSources = anikotoRes.streams
        .filter((s: any) => s.type === "embed" && s.url)
        .map((s: any) => ({
          url: s.url,
          quality: s.server || "Auto",
          isM3U8: false
        }));

      if (embedSources.length > 0) {
        return res.json({
          sources: embedSources,
          sub: audio === 'sub' ? embedSources : [],
          dub: audio === 'dub' ? embedSources : [],
        });
      }
    }

    // 2. Fallback to FilmU
    const anilistIdStr = await getAnilistId(title);
    const anilistId = anilistIdStr ? Number(anilistIdStr) : undefined;
    const fallbackStream = await multiProvider.getStreamInfo(id, parseInt(ep, 10), title, anilistId);
    
    if (fallbackStream && fallbackStream.sources && fallbackStream.sources.length > 0) {
      return res.json(fallbackStream);
    }

    return res.status(404).json({ error: "Stream not found" });
  } catch (error) {
    console.error("Stream fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch stream" });
  }
});

// Start the server with Render-compatible 0.0.0.0 binding
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log('AniWaveX Backend started');
  console.log('Environment: production');
  console.log(`Port: ${PORT}`);
  console.log('Health: /health');
});
