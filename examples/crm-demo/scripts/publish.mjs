/** Hold a real OS process lock for the entire release/recovery invocation. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2);
const index=args.indexOf('--python');
const python=index>=0?args[index+1]:process.env.FUNNEL_PYTHON||'python3';
if(!python || python.startsWith('--')) {
  console.error('Supply the Python executable after --python.');process.exitCode=1;
} else if(!existsSync('scripts/release_state.py')) {
  console.error('The guarded release helpers are missing. Update the project helpers before final QA; do not use an older publisher to bypass recovery checks.');process.exitCode=1;
} else {
  const result=spawnSync(python,['scripts/release_state.py','run','.', '--',process.execPath,path.resolve('scripts/publish-driver.mjs'),...args],{stdio:'inherit'});
  process.exitCode=result.status??1;
}
