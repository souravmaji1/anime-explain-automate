require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const fetch = require('node-fetch');
const { google } = require('googleapis');

// ====================== CONFIG ======================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANILIST_URL = 'https://graphql.anilist.co';
const DEEPGRAM_MODEL = 'aura-2-thalia-en';
const ASSETS_DIR = path.join(__dirname, 'public', 'anime-assets');
const DATA_FILE = path.join(__dirname, 'src', 'remotion-data.json');
const FPS = 30;

// YouTube files
const CLIENT_SECRET_FILE = 'client_secret.json';
const TOKEN_FILE = 'youtube-tokens.json';

const ANIME_ID = process.argv[2] ? parseInt(process.argv[2], 10) : null;

// ====================== HELPERS ======================
const tools = [{
  type: "function",
  function: {
    name: "google_search",
    description: "Search Google for up-to-date information about the anime.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
}];

async function googleSearch(query) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 8 }),
  });
  const data = await res.json();
  return JSON.stringify((data.organic || []).slice(0, 6).map(r => ({
    title: r.title, link: r.link, snippet: r.snippet
  })), null, 2);
}

async function callModel(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://yourdomain.com",
      "X-Title": "Anime Auto Uploader",
    },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto", temperature: 0.7 }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function generateYouTubeMetadata(anime) {
  const title = anime.title.english || anime.title.romaji;
  const synopsis = cleanText(anime.description).slice(0, 600);

  let messages = [{
    role: "system",
    content: `You are an expert YouTube SEO specialist for anime content.

Your task is to create a highly clickable YouTube title based on the anime's story premise.

STRICT TITLE RULES:
- Start with a short, intriguing description of the core story premise (focus on the most unique / emotional / interesting relationship or situation).
- Then add " - " + the official anime name.
- End with a short explanation word like "explained", "story", "review", "explained in 60 seconds", etc.
- Keep the entire title under 70 characters.
- Make it sound natural and curiosity-driven.

Good examples:
- "an introvert boy and his blind girlfriend - Your Name explained"
- "a lonely girl who can see ghosts - Anohana story"
- "the boy who married a goddess - The Ancient Magus Bride"
- "a shut-in gamer trapped in a game - Sword Art Online explained"

Return ONLY valid JSON (no markdown):
{
  "youtube_title": "...",
  "description": "full YouTube description with hashtags",
  "tags": ["tag1", "tag2", "tag3", ...]
}`
  }, {
    role: "user",
    content: `Create YouTube metadata for this anime:

Anime: ${title}
Genres: ${(anime.genres || []).join(", ")}
Synopsis: ${synopsis}

First use the google_search tool to get more accurate info about the plot if needed, then generate the metadata.`
  }];

  let finalContent = null;
  let toolCallCount = 0;

  while (!finalContent && toolCallCount < 5) {
    const result = await callModel(messages);
    const message = result.choices[0].message;

    if (message.tool_calls?.length > 0) {
      messages.push(message);
      for (const toolCall of message.tool_calls) {
        toolCallCount++;
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`🔍 Searching: "${args.query}"`);
        const toolResult = await googleSearch(args.query).catch(e => e.message);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: toolResult
        });
      }
      continue;
    }
    finalContent = message.content;
  }

  const cleaned = finalContent
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

// AniList + other helpers
async function anilistQuery(query, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function cleanText(text = '') {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function downloadFile(url, filepath) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
    return filepath;
  } catch { return null; }
}

async function deepgramTTS(text, outputPath) {
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${DEEPGRAM_MODEL}&encoding=mp3`, {
    method: 'POST',
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await res.text());
  fs.writeFileSync(outputPath, Buffer.from(await res.arrayBuffer()));
}

async function getAudioDuration(filePath) {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
    return parseFloat(stdout.trim()) || 4;
  } catch { return 5; }
}

async function getDeepData(id) {
  const query = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id title { romaji english native } description(asHtml: false) averageScore genres
      coverImage { extraLarge large } bannerImage
      studios { nodes { name isAnimationStudio } }
      characters(sort: ROLE, perPage: 6) { edges { role node { name { full } image { large } } } }
    }
  }`;
  const data = await anilistQuery(query, { id });
  return data.Media;
}

function createScenes(anime) {
  const title = anime.title.english || anime.title.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const studio = anime.studios?.nodes?.find(s => s.isAnimationStudio)?.name || anime.studios?.nodes?.[0]?.name || 'Unknown';
  const synopsis = cleanText(anime.description).slice(0, 300);
  const mainChars = (anime.characters?.edges || []).filter(e => e.role === 'MAIN').slice(0, 3).map(e => e.node.name.full);

  return [
    { id: 'intro', voiceover: `Welcome to the world of ${title}. One of the most talked about anime of the season.`, imageKey: 'banner', textOverlay: title },
    { id: 'synopsis', voiceover: synopsis || `An epic story.`, imageKey: 'cover', textOverlay: 'The Story' },
    { id: 'characters', voiceover: mainChars.length ? `Meet the main characters: ${mainChars.join(', ')}.` : `Unforgettable characters.`, imageKey: 'characters', textOverlay: 'Main Characters' },
    { id: 'stats', voiceover: `With a score of ${score} out of ten and produced by ${studio}, ${title} has taken the anime community by storm.`, imageKey: 'cover', textOverlay: `${score} ★  •  ${studio}` },
    { id: 'outro', voiceover: `Don't miss ${title}. Start watching now!`, imageKey: 'banner', textOverlay: 'Watch Now' },
  ];
}

// ====================== YOUTUBE UPLOAD ======================
async function uploadToYouTube({ videoPath, title, description, tags }) {
  const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE));
  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(tokens);

  const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

  console.log('\n📤 Uploading video to YouTube...');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: '1', // Film & Animation
      },
      status: {
        privacyStatus: 'private', // change to 'public' when ready
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  console.log(`✅ Uploaded! https://youtube.com/watch?v=${res.data.id}`);
  return res.data.id;
}

// ====================== MAIN ======================
(async () => {
  try {
    if (!ANIME_ID) {
      console.error('❌ Please provide AniList ID → node auto.js 202269');
      process.exit(1);
    }

    console.log('🎬 Starting full automatic pipeline...\n');

    // 1. Clean & create folders
    if (fs.existsSync(ASSETS_DIR)) fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'src'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

    // 2. Fetch anime
    console.log(`📡 Fetching anime ID ${ANIME_ID}...`);
    const anime = await getDeepData(ANIME_ID);
    console.log(`   → ${anime.title.english || anime.title.romaji}\n`);

    // 3. Download images
    console.log('🖼️  Downloading images...');
    await downloadFile(anime.coverImage?.extraLarge || anime.coverImage?.large, path.join(ASSETS_DIR, 'cover.jpg'));
    await downloadFile(anime.bannerImage || anime.coverImage?.extraLarge, path.join(ASSETS_DIR, 'banner.jpg'));

    const charFiles = [];
    const mainCharEdges = (anime.characters?.edges || []).filter(e => e.role === 'MAIN').slice(0, 3);
    for (let i = 0; i < mainCharEdges.length; i++) {
      await downloadFile(mainCharEdges[i].node.image.large, path.join(ASSETS_DIR, `char-${i}.jpg`));
      charFiles.push(`char-${i}.jpg`);
    }

    // 4. Generate voiceovers
    console.log('🗣️  Generating voiceovers...');
    const scenes = createScenes(anime);
    const finalScenes = [];

    for (const scene of scenes) {
      const audioPath = path.join(ASSETS_DIR, `${scene.id}.mp3`);
      console.log(`   → ${scene.id}`);
      await deepgramTTS(scene.voiceover, audioPath);
      const durationSec = await getAudioDuration(audioPath);

      finalScenes.push({
        id: scene.id,
        voiceover: scene.voiceover,
        textOverlay: scene.textOverlay,
        audio: `${scene.id}.mp3`,
        durationInFrames: Math.ceil(durationSec * FPS) + 12,
        durationSec: Number(durationSec.toFixed(2)),
        image: scene.imageKey === 'characters'
          ? charFiles.map(f => `anime-assets/${f}`)
          : `anime-assets/${scene.imageKey === 'banner' ? 'banner.jpg' : 'cover.jpg'}`,
      });
    }

    // 5. Generate YouTube metadata
    console.log('\n🧠 Generating YouTube metadata...');
    const ytMeta = await generateYouTubeMetadata(anime);

    // 6. Save Remotion data
    const remotionData = {
      title: anime.title.english || anime.title.romaji,
      titleNative: anime.title.native,
      fps: FPS,
      scenes: finalScenes,
      totalDurationInFrames: finalScenes.reduce((s, x) => s + x.durationInFrames, 0),
      youtube: ytMeta,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(remotionData, null, 2));

    // 7. Render with Remotion
    console.log('\n🎥 Rendering video with Remotion...');
   await execAsync(
  'npx remotion render AnimeVideo out/anime.mp4 --log=verbose --concurrency=1',
  { maxBuffer: 1024 * 1024 * 50 }
);
    console.log('✅ Video rendered → out/anime.mp4');

    // 8. Upload to YouTube
    await uploadToYouTube({
      videoPath: path.join(__dirname, 'out', 'anime.mp4'),
      title: ytMeta.youtube_title,
      description: ytMeta.description,
      tags: ytMeta.tags,
    });

    console.log('\n🎉 COMPLETE! Video is now on your YouTube channel (as private).');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();