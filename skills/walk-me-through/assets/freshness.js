let sourceFolder = null, checkingSources = false;
let useFolderInput = !window.showDirectoryPicker;
const referencedSources = new Map(flow.steps.map(step => [step.source.path, step.source.sha256]));
function freshnessStatus(status, title, detail) {
  el('freshness').dataset.status = status;
  el('freshness-title').textContent = title;
  el('freshness-detail').textContent = detail;
}
async function checkSources(selectedFiles = null, folderName = sourceFolder?.name) {
  if ((!sourceFolder && !selectedFiles) || checkingSources) return;
  checkingSources = true;
  el('recheck-source').disabled = true;
  el('choose-source').disabled = true;
  const changed = [], missing = [], unreadable = [];
  try {
    for (const [path, expected] of referencedSources) {
      try {
        const parts = path.split('/');
        if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid source path');
        let file;
        if (selectedFiles) {
          file = selectedFiles.get(path);
          if (!file) throw new DOMException('Missing', 'NotFoundError');
        } else {
          let directory = sourceFolder;
          for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
          const handle = await directory.getFileHandle(parts.at(-1));
          file = await handle.getFile();
        }
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        if (actual !== expected) changed.push(path);
      } catch (error) {
        if (error.name === 'NotFoundError' || error.name === 'TypeMismatchError') missing.push(path);
        else unreadable.push(path);
      }
    }
    const when = new Date().toLocaleTimeString();
    if (changed.length || missing.length) {
      freshnessStatus('stale', 'Out of date — referenced sources differ',
        `Checked ${when}. ${changed.length ? 'Changed: ' + changed.join(', ') + '. ' : ''}${missing.length ? 'Missing: ' + missing.join(', ') + '. Confirm the selected project root. ' : ''}${unreadable.length ? 'Also unreadable: ' + unreadable.join(', ') + '. ' : ''}Ask the coding agent to review this workflow and regenerate the HTML.`);
    } else if (unreadable.length) {
      freshnessStatus('unknown', 'Source freshness could not be verified', `Checked ${when}. Cannot read: ${unreadable.join(', ')}. Select the source folder again to restore access.`);
    } else {
      freshnessStatus('match', 'Referenced sources match this snapshot', `Checked ${when}: ${referencedSources.size} files in ${folderName}. ${selectedFiles ? 'One-time check. Select the folder again after editing to check for changes.' : 'Rechecks every 30 seconds while visible.'} This does not verify the explanation or unreferenced dependencies.`);
    }
  } finally {
    checkingSources = false;
    el('recheck-source').disabled = !sourceFolder;
    el('choose-source').disabled = false;
  }
}
el('choose-source').onclick = async () => {
  if (useFolderInput) {
    el('source-files').click();
    return;
  }
  try {
    sourceFolder = await window.showDirectoryPicker({mode: 'read'});
    await checkSources();
  } catch (error) {
    if (error.name !== 'AbortError') {
      useFolderInput = true;
      freshnessStatus('unknown', 'Live folder access unavailable', 'Select the folder using the standard picker for a one-time check. Nothing is uploaded.');
      el('source-files').click();
    }
  }
};
el('source-files').onchange = async () => {
  const files = Array.from(el('source-files').files);
  if (!files.length) return;
  sourceFolder = null;
  const selected = new Map(files.map(file => [file.webkitRelativePath.split('/').slice(1).join('/'), file]));
  await checkSources(selected, files[0].webkitRelativePath.split('/')[0]);
  el('source-files').value = '';
};
el('recheck-source').onclick = () => checkSources();
if (!window.crypto?.subtle) {
  el('choose-source').disabled = true;
  freshnessStatus('unknown', 'Source freshness not checked', 'This preview does not expose browser hashing. Open the HTML directly in Chrome or Edge to check source files.');
} else if (!window.showDirectoryPicker) {
  freshnessStatus('unknown', 'Source freshness not checked', 'Select the project folder for a one-time check. This browser cannot automatically recheck files; select the folder again after edits. Nothing is uploaded.');
}
setInterval(() => { if (!document.hidden) checkSources(); }, 30000);
window.addEventListener('focus', () => checkSources());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSources(); });
