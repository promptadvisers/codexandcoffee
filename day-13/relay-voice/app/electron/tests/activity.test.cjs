const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('Firecrawl activity uses orange only while running; terminal outcomes settle to white', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../ui/view.js'), 'utf8');
  const {serviceAsset} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  for (const provider of ['Firecrawl', 'Alexandria']) {
    assert.equal(serviceAsset(provider, 'running'), 'services/firecrawl-active.png');
    for (const status of ['completed', 'failed', 'cancelled']) assert.equal(serviceAsset(provider, status), 'services/firecrawl.png');
  }
  assert.equal(serviceAsset('Google', 'running'), 'services/google.png');
  assert.equal(serviceAsset('Gmail', 'completed'), 'services/gmail.svg');
});

test('only verified new pastes show insertion success', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../ui/view.js'), 'utf8');
  const { outcome } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(outcome('inserted_verified'), 'Inserted into your field');
  assert.equal(outcome('paste_unverified'), 'Paste sent. Check your field.');
});

test('legacy outcomes stay unverified and paste verification remains busy', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../ui/view.js'), 'utf8');
  const { outcome, busy } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.match(outcome('inserted'), /not verified/);
  assert.match(outcome('inserted_value'), /not verified/);
  assert.equal(busy({phase:'inserting'}), true);
  assert.equal(busy({phase:'verifying'}), true);
});

test('answer provider badges use completed receipts, deduplicate providers and preserve tool roles', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../ui/view.js'), 'utf8');
  const { resultProviders } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.deepEqual(resultProviders([
    {id:'state',provider:'Relay',kind:'state',status:'completed'},
    {id:'a',provider:'Firecrawl',status:'running'},
    {id:'a',provider:'Firecrawl',status:'completed',label:'Reading a page'},
    {id:'b',provider:'Firecrawl',status:'completed',label:'Searching the web'},
    {id:'c',provider:'Google',status:'completed',label:'Checking account connection'},
    {id:'d',provider:'Gmail',status:'completed',label:'Reading email'},
    {id:'e',provider:'Alexandria',status:'failed'},
    {id:'f',provider:'Other',status:'cancelled'}
  ]), [
    {provider:'Firecrawl',detail:'Reading a page · Searching the web'},
    {provider:'Google',detail:'Checking account connection'},
    {provider:'Gmail',detail:'Reading email'}
  ]);
  assert.deepEqual(resultProviders(), []);
  assert.deepEqual(resultProviders([{id:'a',provider:'Firecrawl',status:'completed'},{id:'a',provider:'Firecrawl',status:'failed'}]), []);
});
