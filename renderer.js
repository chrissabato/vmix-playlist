const directories = [];
let settingsVisible = true;
let ctrlHeld = false;
const pendingSelections = new Map();

function buildButtons(container, items, sectionIndex) {
  const activeFile = container.querySelector('.item-btn.active')?.dataset.path || null;
  container.innerHTML = '';

  items.forEach(filepath => {
    const parts = filepath.replace(/\\/g, '/').split('/');
    const basename = parts[parts.length - 1];
    const label = basename.replace(/\.[^.]+$/, '');

    const btn = document.createElement('button');
    btn.className = 'item-btn';
    btn.textContent = label;
    btn.dataset.path = filepath;
    if (filepath === activeFile) btn.classList.add('active');
    btn.addEventListener('click', (e) => handleButtonClick(e, sectionIndex, filepath, btn));
    container.appendChild(btn);
  });
}

function handleButtonClick(e, sectionIndex, filepath, btn) {
  if (e.ctrlKey || e.metaKey) {
    btn.classList.toggle('pending');
    let pending = pendingSelections.get(sectionIndex);
    if (!pending) {
      pending = [];
      pendingSelections.set(sectionIndex, pending);
    }
    const idx = pending.findIndex(p => p.filepath === filepath);
    if (idx !== -1) {
      pending.splice(idx, 1);
    } else {
      pending.push({ filepath, btn });
    }
  } else {
    selectItem(sectionIndex, filepath, btn);
  }
}

function renderLists() {
  const container = document.getElementById('lists-row');
  container.innerHTML = '';

  directories.forEach((list, index) => {
    const section = document.createElement('div');
    section.className = 'list-section';
    section.id = 'section-' + index;

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    const h2 = document.createElement('h2');
    h2.textContent = list.name;
    h2.style.marginBottom = '0';
    header.appendChild(h2);

    section.appendChild(header);

    const sectionSettings = document.createElement('div');
    sectionSettings.className = 'section-settings' + (settingsVisible ? '' : ' hidden');

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'remove-btn';
    removeBtn.style.marginBottom = '8px';
    removeBtn.addEventListener('click', () => {
      window.electronAPI.unwatchDirectory(list.dirPath);
      directories.splice(index, 1);
      renderLists();
    });
    sectionSettings.appendChild(removeBtn);

    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'vMix Input:';
    inputRow.appendChild(inputLabel);

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'vmix-input-name';
    inputField.id = 'vmix-input-' + index;
    inputField.value = list.inputName || list.name;
    inputField.addEventListener('change', () => {
      list.inputName = inputField.value;
    });
    inputRow.appendChild(inputField);

    sectionSettings.appendChild(inputRow);

    const replaceRow = document.createElement('div');
    replaceRow.className = 'replace-row';

    const replaceLabel = document.createElement('label');
    replaceLabel.textContent = 'Replace:';
    replaceRow.appendChild(replaceLabel);

    const replaceToggle = document.createElement('button');
    replaceToggle.className = 'toggle-btn' + (list.replace !== false ? ' on' : '');
    replaceToggle.id = 'replace-toggle-' + index;
    replaceToggle.textContent = list.replace !== false ? 'ON' : 'OFF';
    if (list.replace === undefined) list.replace = true;
    replaceToggle.addEventListener('click', () => {
      list.replace = !list.replace;
      replaceToggle.classList.toggle('on', list.replace);
      replaceToggle.textContent = list.replace ? 'ON' : 'OFF';
    });
    replaceRow.appendChild(replaceToggle);

    sectionSettings.appendChild(replaceRow);

    const dirLabel = document.createElement('div');
    dirLabel.className = 'dir-path';
    dirLabel.textContent = list.dirPath;
    sectionSettings.appendChild(dirLabel);

    section.appendChild(sectionSettings);

    const status = document.createElement('div');
    status.className = 'status';
    status.id = 'status-' + index;
    section.appendChild(status);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'buttons';
    buttonsDiv.id = 'buttons-' + index;

    buildButtons(buttonsDiv, list.items, index);

    section.appendChild(buttonsDiv);
    container.appendChild(section);
  });
}

async function addDirectory() {
  const list = await window.electronAPI.pickDirectory();
  if (!list) return;
  directories.push(list);
  renderLists();
}

async function selectItem(sectionIndex, filepath, btn) {
  const section = document.getElementById('section-' + sectionIndex);
  const statusEl = document.getElementById('status-' + sectionIndex);
  const inputName = document.getElementById('vmix-input-' + sectionIndex).value;
  const buttons = section.querySelectorAll('.item-btn');

  buttons.forEach(b => b.disabled = true);
  statusEl.className = 'status';
  statusEl.textContent = 'Sending to vMix...';

  try {
    const vmixHost = document.getElementById('vmix-host').value;
    const vmixPort = document.getElementById('vmix-port').value;
    const replace = directories[sectionIndex].replace !== false;
    const data = await window.electronAPI.selectItem({ list: inputName, item: filepath, vmixHost, vmixPort, replace });
    if (data.ok) {
      statusEl.className = 'status success';
      const parts = filepath.replace(/\\/g, '/').split('/');
      const verb = replace ? 'Set' : 'Added';
      statusEl.textContent = verb + ': ' + parts[parts.length - 1];
      if (replace) {
        section.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
      }
      btn.classList.add('active');
    } else {
      statusEl.className = 'status error';
      statusEl.textContent = 'Error: ' + (data.error || 'Unknown');
    }
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
}

function toggleSettings() {
  settingsVisible = !settingsVisible;
  document.getElementById('settings').classList.toggle('hidden', !settingsVisible);
  document.querySelectorAll('.section-settings').forEach(el => {
    el.classList.toggle('hidden', !settingsVisible);
  });
}

async function flushPendingSelections() {
  for (const [sectionIndex, pending] of pendingSelections.entries()) {
    if (pending.length === 0) continue;

    const section = document.getElementById('section-' + sectionIndex);
    const statusEl = document.getElementById('status-' + sectionIndex);
    const inputName = document.getElementById('vmix-input-' + sectionIndex).value;
    const buttons = section.querySelectorAll('.item-btn');
    const replace = directories[sectionIndex].replace !== false;
    const filepaths = pending.map(p => p.filepath);

    buttons.forEach(b => b.disabled = true);
    statusEl.className = 'status';
    statusEl.textContent = 'Sending ' + filepaths.length + ' items to vMix...';

    try {
      const vmixHost = document.getElementById('vmix-host').value;
      const vmixPort = document.getElementById('vmix-port').value;
      const data = await window.electronAPI.selectItems({ list: inputName, items: filepaths, vmixHost, vmixPort, replace });
      if (data.ok) {
        statusEl.className = 'status success';
        const verb = replace ? 'Set' : 'Added';
        statusEl.textContent = verb + ': ' + filepaths.length + ' items';
        if (replace) {
          section.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
        }
        pending.forEach(p => p.btn.classList.add('active'));
      } else {
        statusEl.className = 'status error';
        statusEl.textContent = 'Error: ' + (data.error || 'Unknown');
      }
    } catch (err) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Error: ' + err.message;
    } finally {
      buttons.forEach(b => {
        b.disabled = false;
        b.classList.remove('pending');
      });
    }
  }
  pendingSelections.clear();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-dir-btn').addEventListener('click', addDirectory);
  document.getElementById('toggle-settings-btn').addEventListener('click', toggleSettings);

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      flushPendingSelections();
    }
  });

  window.electronAPI.onDirectoryChanged(({ dirPath, items }) => {
    const index = directories.findIndex(d => d.dirPath === dirPath);
    if (index === -1) return;
    directories[index].items = items;
    const buttonsDiv = document.getElementById('buttons-' + index);
    if (buttonsDiv) {
      buildButtons(buttonsDiv, items, index);
    }
  });
});
