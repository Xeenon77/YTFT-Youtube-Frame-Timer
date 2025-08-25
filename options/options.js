// options/options.js

// --- DEFAULTS ---
const defaultKeybindings = {
    startReset:       { key: 'ü', code: 'BracketLeft', ctrlKey: false, altKey: false, shiftKey: false },
    startSegment:     { key: 'ö', code: 'Semicolon',   ctrlKey: false, altKey: false, shiftKey: false },
    endSegment:       { key: 'ä', code: 'Quote',       ctrlKey: false, altKey: false, shiftKey: false },
    undoSplit:        { key: 'Backspace', code: 'Backspace',   ctrlKey: false, altKey: false, shiftKey: false },
    endRun:           { key: 'c', code: 'KeyC',        ctrlKey: true,  altKey: false, shiftKey: false },
    toggleVisibility: { key: 'h', code: 'KeyH',        ctrlKey: false, altKey: false, shiftKey: false }
};

// This will hold the default settings once fetched.
let defaultSettings = null;

/**
 * Asynchronously loads the default settings from the data/DEFAULT.json file.
 * Caches the result to avoid redundant fetching.
 * NOTE: For this to work, 'data/DEFAULT.json' must be listed in
 * 'web_accessible_resources' in the manifest.json file.
 * @returns {Promise<object>} A promise that resolves to the default settings object.
 */
async function loadDefaultSettings() {
    if (defaultSettings) {
        return defaultSettings;
    }
    try {
        const response = await fetch(browser.runtime.getURL('data/DEFAULT.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const settings = await response.json();
        defaultSettings = settings; // Cache the successfully loaded settings
        return settings;
    } catch (e) {
        console.error("YTFT: Could not load default settings from data/DEFAULT.json.", e);
        // Return a minimal, valid fallback object to prevent crashes.
        return {
            copyHeader: "Mod edit (Name):",
            active: {},
            data: { "Error": { "Could not load defaults": [] } }
        };
    }
}


// --- DOM ELEMENTS ---
const inputs = {
    startReset: document.getElementById('startReset'),
    startSegment: document.getElementById('startSegment'),
    endSegment: document.getElementById('endSegment'),
    undoSplit: document.getElementById('undoSplit'),
    endRun: document.getElementById('endRun'),
    toggleVisibility: document.getElementById('toggleVisibility')
};
const copyHeaderInput = document.getElementById('copyHeaderText');
const presetGroupSelect = document.getElementById('preset-group-select');
const subPresetSelect = document.getElementById('sub-preset-select');
const splitNamesTextarea = document.getElementById('splitNamePresets');
const importFileInput = document.getElementById('import-file-input');

// --- STATE VARIABLE ---
let tempSettings = {};

// --- HELPER FUNCTIONS ---
function formatKeybinding(kb) {
    if (!kb || !kb.key) return "";
    let parts = [];
    if (kb.ctrlKey) parts.push('Ctrl');
    if (kb.altKey) parts.push('Alt');
    if (kb.shiftKey) parts.push('Shift');
    let displayKey = kb.key.toUpperCase() === ' ' ? 'Space' : kb.key;
    // Don't show the letter if Shift is already present (e.g., "Shift + C" instead of "Shift + shift + c")
    // But do show for symbols (e.g., "Shift + 4" for "$")
    if (kb.key.length > 1 || !kb.shiftKey) {
        parts.push(displayKey);
    }
    return parts.join(' + ');
}

// --- PRESET MANAGEMENT LOGIC ---
function populateGroupDropdown() {
    presetGroupSelect.innerHTML = '';
    const groups = Object.keys(tempSettings.presets.data);
    if (groups.length === 0) {
        // This case should ideally not happen if fallback works, but is a safeguard.
        presetGroupSelect.innerHTML = `<option>No Presets</option>`;
        subPresetSelect.innerHTML = '';
        splitNamesTextarea.value = '';
        return;
    }
    groups.forEach(groupName => {
        const option = document.createElement('option');
        option.value = groupName;
        option.textContent = groupName;
        presetGroupSelect.appendChild(option);
    });
    if (tempSettings.presets.active && tempSettings.presets.data[tempSettings.presets.active.group]) {
        presetGroupSelect.value = tempSettings.presets.active.group;
    } else {
        tempSettings.presets.active.group = groups[0];
        presetGroupSelect.value = groups[0];
    }
    populateSubPresetDropdown();
}

function populateSubPresetDropdown() {
    subPresetSelect.innerHTML = '';
    const activeGroup = presetGroupSelect.value;
    if (!activeGroup || !tempSettings.presets.data[activeGroup] || Object.keys(tempSettings.presets.data[activeGroup]).length === 0) {
        splitNamesTextarea.value = '';
        return;
    }
    const subPresets = Object.keys(tempSettings.presets.data[activeGroup]);
    subPresets.forEach(subName => {
        const option = document.createElement('option');
        option.value = subName;
        option.textContent = subName;
        subPresetSelect.appendChild(option);
    });
    if (tempSettings.presets.active && tempSettings.presets.data[activeGroup][tempSettings.presets.active.sub]) {
        subPresetSelect.value = tempSettings.presets.active.sub;
    } else {
        tempSettings.presets.active.sub = subPresets[0];
        subPresetSelect.value = subPresets[0];
    }
    loadPresetSplits();
}

function loadPresetSplits() {
    const group = presetGroupSelect.value;
    const sub = subPresetSelect.value;
    if (group && sub && tempSettings.presets.data[group] && tempSettings.presets.data[group][sub]) {
        splitNamesTextarea.value = tempSettings.presets.data[group][sub].join('\n');
    } else {
        splitNamesTextarea.value = '';
    }
}

function saveCurrentPresetSplits() {
    const group = tempSettings.presets.active.group;
    const sub = tempSettings.presets.active.sub;
    if (group && sub && tempSettings.presets.data[group] && typeof tempSettings.presets.data[group][sub] !== 'undefined') {
        const splitNames = splitNamesTextarea.value.split('\n').filter(name => name.trim() !== '');
        tempSettings.presets.data[group][sub] = splitNames;
    }
}

// --- IMPORT/EXPORT LOGIC ---
function handleExport() {
    saveCurrentPresetSplits();
    const presetsToExport = tempSettings.presets;
    const jsonString = JSON.stringify(presetsToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ytft-presets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const status = document.getElementById('status');
    status.textContent = 'Presets exported successfully.';
    setTimeout(() => { status.textContent = ''; }, 2000);
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedPresets = JSON.parse(e.target.result);
            if (!importedPresets.active || !importedPresets.data || typeof importedPresets.data !== 'object') {
                throw new Error("Invalid or malformed preset file.");
            }
            if (confirm("This will overwrite all current presets with the content from the file. Are you sure?")) {
                tempSettings.presets = importedPresets;
                populateGroupDropdown();
                const status = document.getElementById('status');
                status.textContent = 'Presets imported successfully.';
                setTimeout(() => { status.textContent = ''; }, 2000);
            }
        } catch (error) {
            alert(`Error importing file: ${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// --- EVENT LISTENERS ---
presetGroupSelect.addEventListener('change', () => {
    saveCurrentPresetSplits();
    tempSettings.presets.active.group = presetGroupSelect.value;
    const newGroupSubs = Object.keys(tempSettings.presets.data[presetGroupSelect.value]);
    tempSettings.presets.active.sub = newGroupSubs[0] || '';
    populateSubPresetDropdown();
});
subPresetSelect.addEventListener('change', () => {
    saveCurrentPresetSplits();
    tempSettings.presets.active.sub = subPresetSelect.value;
    loadPresetSplits();
});

document.getElementById('import-btn').addEventListener('click', () => importFileInput.click());
document.getElementById('export-btn').addEventListener('click', handleExport);
importFileInput.addEventListener('change', handleImport);

document.getElementById('add-group-btn').addEventListener('click', () => {
    const newGroupName = prompt("Enter new group name:", "New Preset Group");
    if (!newGroupName || tempSettings.presets.data[newGroupName]) return;
    saveCurrentPresetSplits();
    tempSettings.presets.data[newGroupName] = { 'Default Sub-Preset': [] };
    tempSettings.presets.active = { group: newGroupName, sub: 'Default Sub-Preset' };
    populateGroupDropdown();
});

document.getElementById('add-sub-preset-btn').addEventListener('click', () => {
    const activeGroup = presetGroupSelect.value;
    if (!activeGroup) { alert("Please create a group first."); return; }
    const newSubName = prompt(`Enter new sub-preset name for group "${activeGroup}":`, "New Sub-Preset");
    if (!newSubName || tempSettings.presets.data[activeGroup][newSubName]) return;
    saveCurrentPresetSplits();
    tempSettings.presets.data[activeGroup][newSubName] = [];
    tempSettings.presets.active.sub = newSubName;
    populateSubPresetDropdown();
});

document.getElementById('rename-btn').addEventListener('click', () => {
    const oldGroup = presetGroupSelect.value;
    const oldSub = subPresetSelect.value;
    if (!oldGroup || !oldSub) { alert("No preset selected to rename."); return; }
    const newName = prompt(`Enter new name for "${oldSub}" in "${oldGroup}":`, oldSub);
    if (!newName || newName === oldSub || tempSettings.presets.data[oldGroup][newName]) return;
    
    saveCurrentPresetSplits();
    const content = tempSettings.presets.data[oldGroup][oldSub];
    delete tempSettings.presets.data[oldGroup][oldSub];
    tempSettings.presets.data[oldGroup][newName] = content;
    tempSettings.presets.active.sub = newName;
    populateSubPresetDropdown();
});

document.getElementById('delete-btn').addEventListener('click', () => {
    const groupToDeleteFrom = presetGroupSelect.value;
    const subToDelete = subPresetSelect.value;
    if (!groupToDeleteFrom || !subToDelete) { alert("Nothing selected to delete."); return; }
    if (!confirm(`Are you sure you want to delete "${subToDelete}" from "${groupToDeleteFrom}"? This cannot be undone.`)) return;

    delete tempSettings.presets.data[groupToDeleteFrom][subToDelete];
    
    if (Object.keys(tempSettings.presets.data[groupToDeleteFrom]).length === 0) {
        delete tempSettings.presets.data[groupToDeleteFrom];
        const remainingGroups = Object.keys(tempSettings.presets.data);
        tempSettings.presets.active.group = remainingGroups[0] || '';
    }
    const remainingSubs = tempSettings.presets.active.group ? Object.keys(tempSettings.presets.data[tempSettings.presets.active.group] || {}) : [];
    tempSettings.presets.active.sub = remainingSubs[0] || '';
    populateGroupDropdown();
});

for (const action in inputs) {
    const input = inputs[action];
    input.addEventListener('focus', () => { input.value = "Press a key..."; });
    input.addEventListener('blur', () => { input.value = formatKeybinding(tempSettings.keybindings[action]); });
    input.addEventListener('keydown', (e) => {
        e.preventDefault();
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        const newBinding = { key: e.key, code: e.code, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey };
        input.value = formatKeybinding(newBinding);
        tempSettings.keybindings[action] = newBinding;
        input.blur();
    });
}

document.getElementById('save-button').addEventListener('click', saveOptions);
document.getElementById('reset-button').addEventListener('click', resetToDefaults);

// --- CORE SAVE/LOAD FUNCTIONS ---
function saveOptions() {
    saveCurrentPresetSplits();
    tempSettings.copyHeaderText = copyHeaderInput.value;
    browser.storage.sync.set({ settings: tempSettings }).then(() => {
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        setTimeout(() => { status.textContent = ''; }, 2000);
    });
}

async function restoreOptions() {
    const data = await browser.storage.sync.get("settings");
    const s = data.settings;
    const loadedDefaults = await loadDefaultSettings();
    const defaultPresets = { active: loadedDefaults.active, data: loadedDefaults.data };


    tempSettings = {
        keybindings: (s && s.keybindings) || JSON.parse(JSON.stringify(defaultKeybindings)),
        copyHeaderText: (s && typeof s.copyHeaderText !== 'undefined') ? s.copyHeaderText : loadedDefaults.copyHeader,
        presets: (s && s.presets && s.presets.data) ? s.presets : JSON.parse(JSON.stringify(defaultPresets))
    };

    for (const action in inputs) { 
        if (inputs[action] && tempSettings.keybindings[action]) {
            inputs[action].value = formatKeybinding(tempSettings.keybindings[action]); 
        }
    }
    copyHeaderInput.value = tempSettings.copyHeaderText;
    populateGroupDropdown();
}

async function resetToDefaults() {
    if (!confirm("Are you sure you want to reset all settings to their defaults? This will erase all your presets.")) return;
    
    const loadedDefaults = await loadDefaultSettings();
    const defaultPresets = { active: loadedDefaults.active, data: loadedDefaults.data };

    tempSettings = {
        keybindings: JSON.parse(JSON.stringify(defaultKeybindings)),
        copyHeaderText: loadedDefaults.copyHeader,
        presets: JSON.parse(JSON.stringify(defaultPresets))
    };
    saveOptions();
    restoreOptions();
}

document.addEventListener('DOMContentLoaded', restoreOptions);