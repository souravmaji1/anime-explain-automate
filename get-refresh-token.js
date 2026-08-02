const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const open = require('open'); // npm install open

const CLIENT_SECRET_FILE = 'client_secret.json'; // put the downloaded file here
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // important to force refresh_token
});

console.log('Authorize this app by visiting this url:', authUrl);

// Simple local server to catch the code
const server = http.createServer(async (req, res) => {
  if (req.url.indexOf('/oauth2callback') > -1) {
    const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
    const code = qs.get('code');
    res.end('Authentication successful! You can close this window.');
    server.close();

    const { tokens } = await oAuth2Client.getToken(code);
    console.log('\n✅ Refresh Token:');
    console.log(tokens.refresh_token);

    // Save it
    fs.writeFileSync('youtube-tokens.json', JSON.stringify(tokens, null, 2));
    console.log('\nTokens saved to youtube-tokens.json');
  }
}).listen(3000, () => {
  open(authUrl);
});