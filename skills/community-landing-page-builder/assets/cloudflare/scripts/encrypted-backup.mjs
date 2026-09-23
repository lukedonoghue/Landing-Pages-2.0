// Run only in a trusted operator shell, not an agent sandbox. The recipient is
// a public age key; the private decryption key must not be on this machine.
import {mkdtempSync,chmodSync,rmSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {runBackup} from './backup.mjs';
import {externalOutput} from './google-sheets-connector.mjs';
export function encryptedBackup(args,{run=spawnSync,backup=runBackup}={}) {
  const options={};for(let i=0;i<args.length;i+=2){if(!['--out','--recipient'].includes(args[i])||options[args[i]]||!args[i+1])throw new Error('Supply --out and --recipient.');options[args[i]]=args[i+1];}
  if(!/^age1[0-9a-z]{58}$/.test(options['--recipient']||''))throw new Error('Use a public age recipient, never a private key.');
  const out=externalOutput(options['--out']);if(!out.endsWith('.sql.age'))throw new Error('Use an external .sql.age output.');
  if(run('age',['--version'],{stdio:'ignore'}).status!==0)throw new Error('Install age in the trusted operator environment before exporting.');
  const temp=mkdtempSync(path.join(os.tmpdir(),'crm-encrypted-backup-'));chmodSync(temp,0o700);let fd;
  try {
    const sql=path.join(temp,'database.sql');
    backup(['export','--remote','--out',sql,'--allow-plaintext-temporary'],{log:()=>{}});
    fd=openSync(out,'wx',0o600);
    const result=run('age',['--encrypt','--recipient',options['--recipient'],sql],{stdio:['ignore',fd,'pipe']});
    if(result.status!==0)throw new Error('Backup encryption failed; no SQL was logged.');
    closeSync(fd);fd=undefined;return {status:'encrypted',file:out};
  } catch(error) {if(fd!==undefined){closeSync(fd);fd=undefined;unlinkSync(out);}throw error;}
  finally {rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(encryptedBackup(process.argv.slice(2))));}catch{console.error('Encrypted backup failed. Check age, the public recipient, external destination and authorized provider access.');process.exitCode=1;}}
