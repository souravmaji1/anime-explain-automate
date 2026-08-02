const { google } = require('googleapis');
const fs = require('fs');

const CLIENT_SECRET_FILE = 'client_secret.json';
const CODE = ''; // ← paste your code here

const credentials = JSON.parse(fs.readFileSync(CLIENT_SECRET_FILE));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost'   // important: match what Google used
);

async function run() {
  try {
    const { tokens } = await oAuth2Client.getToken(CODE);
    console.log('\n✅ Success! Here is your refresh_token:\n');
    console.log(tokens.refresh_token);

    fs.writeFileSync('youtube-tokens.json', JSON.stringify(tokens, null, 2));
    console.log('\nTokens saved to youtube-tokens.json');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();