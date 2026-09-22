import { readFile, writeFile, mkdir, readdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gatewayHosts } from '../pages-gateway/_worker.js';

const adapter = new URL('../pages-gateway/_worker.js', import.meta.url);
const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

async function directory(path, allowed) {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Gateway output must be a real directory.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(path);
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (allowed && (!allowed.includes(entry.name) || entry.isSymbolicLink())) {
      throw new Error('Gateway output contains unexpected files; use a clean build/pages-gateway directory.');
    }
  }
}

export async function buildPagesGateway(options, root = process.cwd()) {
  const { project, pagesHost, accountId, publicHost, crmHost } = options;
  const vars = { GATEWAY_PROJECT: project, GATEWAY_PAGES_HOST: pagesHost, GATEWAY_PUBLIC_HOST: publicHost, GATEWAY_CRM_HOST: crmHost };
  if (!gatewayHosts(vars)) throw new Error('Provide a valid project name, its exact verified project.pages.dev host, and two distinct lowercase custom subdomains (no URLs, ports or wildcards).');
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/.test(accountId)) throw new Error('Provide the selected 32-character lowercase Cloudflare account ID.');
  // This repository stores strict JSON in wrangler.jsonc. Copy only the reviewed fields.
  let worker;
  try { worker = JSON.parse(await readFile(join(root, 'wrangler.jsonc'), 'utf8')); }
  catch { throw new Error('The existing wrangler.jsonc must contain valid JSON.'); }
  if (!namePattern.test(worker.name || '') || worker.pages_build_output_dir !== undefined || !worker.main) throw new Error('Configure an existing Worker with a valid name and main entrypoint first.');
  if (worker.account_id !== accountId) throw new Error('Account ID must match the explicitly configured existing Worker account_id.');
  if (worker.env) throw new Error('Select a flat production Worker configuration without environment overrides.');
  if (project === worker.name) throw new Error('Use a distinct Pages gateway project name.');

  const config = {
    name: project,
    pages_build_output_dir: './public',
    compatibility_date: '2026-07-22',
    services: [{ binding: 'FUNNEL', service: worker.name }],
    vars
  };
  const source = await readFile(adapter, 'utf8');
  const build = resolve(root, 'build');
  const output = join(build, 'pages-gateway');
  await directory(build);
  await directory(output, ['wrangler.jsonc', 'public']);
  await directory(join(output, 'public'), ['_worker.js', '_routes.json']);
  for (const [path, contents] of [
    [join(output, 'wrangler.jsonc'), JSON.stringify(config, null, 2) + '\n'],
    [join(output, 'public', '_worker.js'), source],
    [join(output, 'public', '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }, null, 2) + '\n']
  ]) await writeFile(path, contents);
  return { output, config };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: Object.fromEntries(['project', 'pages-host', 'account-id', 'public-host', 'crm-host'].map(key => [key, { type: 'string' }])), strict: true, allowPositionals: false });
    const result = await buildPagesGateway({ project: values.project, pagesHost: values['pages-host'], accountId: values['account-id'], publicHost: values['public-host'], crmHost: values['crm-host'] });
    console.log(`Built ${result.output}. No remote changes made. Review before deployment.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
