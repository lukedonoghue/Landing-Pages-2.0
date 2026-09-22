import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const privateDirectory = path.join(root, '.secrets', 'google-sheets');
const codePath = path.join(privateDirectory, 'Code.gs');
const connectionPath = path.join(privateDirectory, 'connection.json');
const templatePath = path.join(root, 'google-apps-script', 'Code.gs');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function writePrivate(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}

function webAppUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Use the deployed Apps Script web app URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error('Use an unmodified https://script.google.com/macros/s/.../exec URL.');
  }
  return url.href;
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'prepare') {
    if (existsSync(codePath) || existsSync(connectionPath)) throw new Error('Google Sheets connection files already exist. Keep the existing token or remove them through the reviewed recovery process.');
    const token = randomBytes(32).toString('hex');
    const template = readFileSync(templatePath, 'utf8');
    if (!template.includes('__CRM_CONNECTION_TOKEN__')) throw new Error('Apps Script template is missing its private token marker.');
    writePrivate(codePath, template.replace('__CRM_CONNECTION_TOKEN__', token));
    writePrivate(connectionPath, JSON.stringify({ schema_version: 1, status: 'prepared', token, web_app_url: null, webhook_url: null }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'prepared', code_file: path.relative(root, codePath), connection_file: path.relative(root, connectionPath), next: 'Paste the private Code.gs file into the bound Apps Script project and deploy it as a web app.' }, null, 2));
  } else if (command === 'connect') {
    const index = rest.indexOf('--web-app-url');
    if (index === -1 || !rest[index + 1]) throw new Error('Supply --web-app-url with the deployed Apps Script /exec URL.');
    if (!existsSync(connectionPath)) throw new Error('Run prepare first.');
    const saved = JSON.parse(readFileSync(connectionPath, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(saved.token || '')) throw new Error('The private connection token is missing or invalid.');
    const endpoint = new URL(webAppUrl(rest[index + 1]));
    endpoint.searchParams.set('token', saved.token);
    writeFileSync(connectionPath, JSON.stringify({ ...saved, status: 'ready', web_app_url: endpoint.origin + endpoint.pathname, webhook_url: endpoint.href }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    console.log(JSON.stringify({ status: 'ready', connection_file: path.relative(root, connectionPath), next: 'Add the private webhook_url to CRM Connections as Google Sheets, then run an authorized synthetic live lead.' }, null, 2));
  } else {
    fail('Usage: node scripts/google-sheets-connector.mjs prepare | connect --web-app-url https://script.google.com/macros/s/.../exec');
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'Google Sheets connection setup failed.');
}
