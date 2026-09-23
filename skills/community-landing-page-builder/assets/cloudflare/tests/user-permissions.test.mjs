import test from 'node:test';
import assert from 'node:assert/strict';
import {accountControls} from '../public/admin/users.js';
const owner={id:'owner',role:'admin'};
const admin={id:'admin-2',role:'admin',status:'active'};
const manager={id:'manager-1',role:'manager',status:'active'};
test('non-owner cannot display an admin role grant or edit an existing administrator',()=>{
  assert.deepEqual(accountControls(admin,manager,'manual').roles,['manager','viewer']);
  const other={...admin,id:'admin-3'};
  assert.equal(accountControls(admin,other,'manual').immutable,true);
  assert.equal(accountControls(admin,other,'manual').invite,false);
  assert.equal(accountControls(owner,other,'manual').immutable,false);
  assert.ok(accountControls(owner,manager,'manual').roles.includes('admin'));
});
test('manual privileged reset is unavailable even to another administrator or owner',()=>{
  for(const actor of [owner,admin]) for(const target of [{...owner,status:'active'},admin,{...admin,id:'admin-3'}]) {
    assert.equal(accountControls(actor,target,'manual').reset,false);
  }
  assert.equal(accountControls(owner,manager,'manual').reset,true);
  assert.equal(accountControls(manager,manager,'manual').reset,false);
  assert.equal(accountControls(owner,admin,'email').reset,true);
});
test('owner and self access remain immutable; disabled users have no reset action',()=>{
  assert.equal(accountControls(owner,{...owner,status:'active'},'email').immutable,true);
  assert.equal(accountControls(admin,admin,'email').immutable,true);
  assert.equal(accountControls(owner,{...manager,status:'disabled'},'manual').reset,false);
});
