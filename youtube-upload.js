const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CLIENT_SECRET_FILE = 'client_secret.json';
const TOKEN_FILE = 'youtube-tokens.json';

async function uploadToYouTube({
  videoPath,
  title,
  description,
  tags = [],
  privacyStatus = 'private', // 'public', 'unlisted', or 'private'
  thumbnailPath = null,
}) {
  const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE));
  const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE));

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(tokens);

  // Auto refresh if needed
  oAuth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      tokens.refresh_token = newTokens.refresh_token;
    }
    tokens.access_token = newTokens.access_token;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  });

  const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

  console.log('📤 Uploading video to YouTube...');

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: '1', // Film & Animation (good for anime)
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;
  console.log(`✅ Video uploaded! ID: ${videoId}`);
  console.log(`   URL: https://youtube.com/watch?v=${videoId}`);

  // Optional: Upload custom thumbnail
  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: fs.createReadStream(thumbnailPath),
      },
    });
    console.log('🖼️  Thumbnail uploaded');
  }

  return videoId;
}

module.exports = { uploadToYouTube };