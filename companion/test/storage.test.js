import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { acquireLock } from '../src/lock.js';
import { fixture } from './helpers.js';

test('one process owns a data directory and releases it for a later run',async()=>{
 const f=await fixture();let release;
 try{
  release=await acquireLock(f.directory);await assert.rejects(acquireLock(f.directory),/already running/);
  await release();release=await acquireLock(f.directory);
  await f.storage.write('private.json',{secret:'test-only'});assert.equal((await stat(join(f.directory,'private.json'))).mode&0o777,0o600);
  await assert.rejects(f.storage.read('../private.json'),/Invalid storage/);
 }finally{if(release)await release();await f.cleanup()}
});
