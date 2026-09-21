import test from 'node:test';
import assert from 'node:assert/strict';
import {freePlanFailures} from '../scripts/free-plan.mjs';
test('standard Worker and D1 need no paid add-on',()=>{
  assert.deepEqual(freePlanFailures({name:'demo',d1_databases:[{binding:'DB'}],workers_dev:true}),[]);
});
test('unrestricted email and extra unreviewed services are blocked',()=>{
  assert.ok(freePlanFailures({send_email:[{name:'EMAIL'}]}).length);
  for(const key of ['ai','browser','images','queues','vectorize','durable_objects','r2_buckets','unsafe','env'])assert.ok(freePlanFailures({[key]:{}}).length,key);
});
test('free email requires matching sender and verified-recipient restrictions',()=>{
  const config={send_email:[{name:'EMAIL',allowed_sender_addresses:['crm@example.invalid'],allowed_destination_addresses:['owner@example.invalid']}],vars:{CRM_EMAIL_FROM:'crm@example.invalid',CRM_PUBLIC_ORIGIN:'https://demo.workers.dev',CRM_VERIFIED_RECIPIENTS:'["owner@example.invalid"]'}};
  assert.deepEqual(freePlanFailures(config),[]);
  config.send_email[0].allowed_destination_addresses.push('not-approved@example.invalid');
  assert.ok(freePlanFailures(config).length);
});
test('usage monitor stays optional and rejects public or broad credentials',()=>{
  assert.deepEqual(freePlanFailures({vars:{}}),[]);
  assert.deepEqual(freePlanFailures({vars:{CF_USAGE_ACCOUNT_ID:'a'.repeat(32)}}),[]);
  assert.ok(freePlanFailures({vars:{CF_USAGE_ACCOUNT_ID:'wrong'}}).length);
  assert.ok(freePlanFailures({vars:{CF_ACCOUNT_ANALYTICS_TOKEN:'must-be-secret'}}).length);
  assert.ok(freePlanFailures({vars:{CLOUDFLARE_API_TOKEN:'broad-token'}}).length);
  assert.ok(freePlanFailures({vars:{CLOUDFLARE_API_KEY:'broad-key'}}).length);
});
