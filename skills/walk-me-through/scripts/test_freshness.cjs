// Pass an existing @playwright/test installation as argv[2]; the viewer itself has no dependencies.
const {chromium} = require(process.argv[2] || '@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-freshness-'));
  let browser;
  try {
    fs.mkdirSync(path.join(fixture, 'src'));
    const source = path.join(fixture, 'src/example.py');
    const original = 'print("hello")\r\n';
    fs.writeFileSync(source, original);
    fs.writeFileSync(path.join(fixture, 'flow.json'), JSON.stringify({
      title: 'Freshness test', summary: 'Check source changes',
      steps: [{id: 'read', title: 'Read', explanation: 'Example', boundary: 'Source',
        source: {path: 'src/example.py', start: 1, end: 1}, inputs: {}, outputs: {}, state: {}}],
      scenarios: [{id: 'ok', title: 'Success', description: 'Example', steps: ['read']}]
    }));
    execFileSync('python3', [path.join(__dirname, 'build.py'), '--root', fixture,
      '--flow', path.join(fixture, 'flow.json'), '--output', path.join(fixture, 'viewer.html')]);
    browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    await page.clock.install();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('readSourceFixture', relative => {
      try {return {bytes: [...fs.readFileSync(path.join(fixture, relative))]};}
      catch (error) {if (error.code === 'ENOENT') return {missing: true}; throw error;}
    });
    // The OS folder prompt needs a human; a handle stub reads real mutable fixture files.
    await page.addInitScript(() => {
      window.pickerFailure = null;
      window.readFailure = false;
      function directory(prefix = '') {
        return {name: 'fixture', getDirectoryHandle: async name => directory(prefix + name + '/'),
          getFileHandle: async name => ({getFile: async () => {
            if (window.readFailure) throw new DOMException('Denied', 'NotAllowedError');
            const source = await window.readSourceFixture(prefix + name);
            if (source.missing) throw new DOMException('Missing', 'NotFoundError');
            return new File([new Uint8Array(source.bytes)], name);
          }})};
      }
      window.showDirectoryPicker = async () => {
        if (window.pickerFailure) throw new DOMException('Picker failed', window.pickerFailure);
        return directory();
      };
    });
    await page.goto('file://' + path.join(fixture, 'viewer.html'));
    const status = () => page.locator('#freshness').getAttribute('data-status');
    const check = async expected => {
      await page.locator('#recheck-source').click();
      await page.waitForFunction(() => !document.getElementById('recheck-source').disabled);
      assert.equal(await status(), expected);
    };
    assert.equal(await status(), 'unknown');
    await page.locator('#choose-source').click();
    await page.waitForFunction(() => document.getElementById('freshness').dataset.status === 'match');
    assert.equal(await page.locator('#play').isDisabled(), true);
    fs.appendFileSync(source, '\n');
    await check('stale');
    assert.match(await page.locator('#freshness-detail').innerText(), /Changed: src\/example.py/);
    fs.writeFileSync(source, original);
    await check('match');
    fs.unlinkSync(source);
    await check('stale');
    assert.match(await page.locator('#freshness-detail').innerText(), /Missing:/);
    fs.writeFileSync(source, original);
    await page.evaluate(() => {window.readFailure = true;});
    await check('unknown');
    await page.evaluate(() => {window.readFailure = false;});
    await check('match');
    await page.evaluate(() => {window.pickerFailure = 'AbortError';});
    await page.locator('#choose-source').click();
    assert.equal(await status(), 'match');
    fs.appendFileSync(source, '# changed\n');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.getElementById('freshness').dataset.status === 'stale');
    fs.writeFileSync(source, original);
    await check('match');
    fs.appendFileSync(source, '# periodic change\n');
    await page.clock.fastForward(30000);
    await page.waitForFunction(() => document.getElementById('freshness').dataset.status === 'stale');
    assert.deepEqual(errors, []);
    const unsupported = await browser.newPage();
    await unsupported.addInitScript(() => {window.showDirectoryPicker = undefined;});
    await unsupported.goto('file://' + path.join(fixture, 'viewer.html'));
    assert.equal(await unsupported.locator('#choose-source').isDisabled(), false);
    assert.equal(await unsupported.locator('#freshness').getAttribute('data-status'), 'unknown');
    fs.writeFileSync(source, original);
    const chooser = unsupported.waitForEvent('filechooser');
    await unsupported.locator('#choose-source').click();
    await (await chooser).setFiles(fixture);
    await unsupported.waitForFunction(() => document.getElementById('freshness').dataset.status === 'match');
    assert.match(await unsupported.locator('#freshness-detail').innerText(), /One-time check/);
    assert.equal(await unsupported.locator('#recheck-source').isDisabled(), true);
    fs.appendFileSync(source, '# fallback change\n');
    await unsupported.locator('#source-files').setInputFiles(fixture);
    await unsupported.waitForFunction(() => document.getElementById('freshness').dataset.status === 'stale');
    await page.evaluate(() => {window.pickerFailure = 'SecurityError';});
    const blockedChooser = page.waitForEvent('filechooser');
    await page.locator('#choose-source').click();
    await (await blockedChooser).setFiles(fixture);
    await page.waitForFunction(() => document.getElementById('freshness').dataset.status === 'stale');
    assert.equal(await page.locator('#recheck-source').isDisabled(), true);
    const noHash = await browser.newPage();
    await noHash.addInitScript(() => Object.defineProperty(window.crypto, 'subtle', {value: undefined}));
    await noHash.goto('file://' + path.join(fixture, 'viewer.html'));
    assert.match(await noHash.locator('#freshness-detail').innerText(), /does not expose browser hashing/);
    console.log('Freshness passed: live checks, edit/restore/missing/permission states, folder-input fallback with real files, and explicit no-hashing guidance.');
  } finally {
    if (browser) await browser.close();
    fs.rmSync(fixture, {recursive: true, force: true});
  }
})().catch(error => {console.error(error); process.exit(1);});
