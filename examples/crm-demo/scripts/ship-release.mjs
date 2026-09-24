/** Invoked only under release_state.py's real OS publisher lock. */
import {publishSaved} from './ship-provider.mjs';
try { const result=await publishSaved(process.cwd());console.log(JSON.stringify({status:result.status}));if(result.status!=='verified')process.exitCode=1; }
catch { console.error('The saved release needs reconciliation. Reopen the publishing wizard; no new upload was assumed.');process.exitCode=1; }
