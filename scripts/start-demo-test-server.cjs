// Build sample data into a separate app; never reuse the user's normal Learn.
const { cp, mkdir, mkdtemp, writeFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');
let child;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  child?.kill();
  process.exit(0);
});

(async () => {
  const workspace = process.cwd();
  await mkdir(path.join(workspace, '.tools'), { recursive: true });
  const project = await mkdtemp(path.join(workspace, '.tools', 'demo-test-server-'));
  await Promise.all(['app', 'components', 'data', 'lib', 'types', 'public'].map(name => cp(path.join(workspace, name), path.join(project, name), { recursive: true })));
  await Promise.all(['tsconfig.json', 'postcss.config.mjs', 'next-env.d.ts', 'next.config.ts'].map(name => cp(path.join(workspace, name), path.join(project, name))));
  await writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'isolated-demo-tests', private: true }));
  const env = { ...process.env, NEXT_PUBLIC_DATA_MODE: 'demo', NEXT_PUBLIC_DEMO_CATALOG: '1', BI_SOCIETY_APP_ENV: 'test', BI_SOCIETY_ALLOW_DEMO_PREVIEW: '1', NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(workspace, 'node_modules/next/dist/bin/next');
  const run = args => {
    child = spawn(process.execPath, [next, ...args], { cwd: workspace, env, windowsHide: true, stdio: 'inherit' });
    return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  };
  const build = await run(['build', project]);
  if (build) { process.exitCode = build; return; }
  process.exitCode = await run(['start', project, '--hostname', 'localhost', '--port', process.argv[2] || '3001']);
})().catch(error => { console.error(error); child?.kill(); process.exitCode = 1; });
