// options/options.js

// --- DEFAULTS ---
const defaultKeybindings = {
    startReset:   { key: 'ü', code: 'BracketLeft', ctrlKey: false, altKey: false, shiftKey: false },
    startSegment: { key: 'ö', code: 'Semicolon',   ctrlKey: false, altKey: false, shiftKey: false },
    endSegment:   { key: 'ä', code: 'Quote',       ctrlKey: false, altKey: false, shiftKey: false },
    endRun:       { key: '$', code: 'Digit4',      ctrlKey: false, altKey: false, shiftKey: true }
};

// --- NEW: Comprehensive default preset list ---
const defaultPresets = {
  "active": {
    "group": "Original Heists",
    "sub": "Fleeca Job"
  },
  "data": {
    "Original Heists": {
      "Fleeca Job": [ "Scope Out", "Kuruma", "Finale" ],
      "Prison Break": [ "Plane", "Bus", "Station", "Wet Work", "Finale" ],
      "Humane Labs Raid": [ "Key Codes", "Insurgents", "EMP", "Valkyrie", "Deliver EMP", "Finale" ],
      "Series A Funding": [ "Coke", "Trash Truck", "Bikers", "Weed", "Steal Meth", "Finale" ],
      "Pacific Standard Job": [ "Vans", "Signal", "Hack", "Convoy", "Bikes", "Finale" ]
    },
    "The Doomsday Heist": {
      "Act I: The Data Breaches": [ "Setup 1", "Setup 2", "Setup 3", "Finale" ],
      "Act II: The Bogdan Problem": [ "Setup 1", "Setup 2", "Setup 3", "Setup 4", "Finale" ],
      "Act III: The Doomsday Scenario": [ "Setup 1", "Setup 2", "Setup 3", "Setup 4", "Setup 5", "Setup 6", "Finale" ]
    },
    "The Diamond Casino Heist": {
      "Aggressive": [ "Setup", "Entrance", "Escape" ],
      "Big Con": [ "Setup", "Entrance", "Escape" ],
      "Silent & Sneaky": [ "Setup", "Entrance", "Escape" ]
    },
    "The Cayo Perico Heist": {
      "Solo": [ "Intel", "Prep", "Finale" ],
      "Duo+": [ "Intel", "Prep", "Finale" ]
    },
    "The Contract": {
      "Any%": [ "Investivation 1", "Investivation 2", "Investivation 3", "Finale" ]
    },
    "Cluckin' Bell Farm Raid": {
      "Any%": [ "Setup 1", "Setup 2", "Finale" ]
    },
    "Miscellaneous & Missions": {
      "All Casino Missions": [ "Mission 1", "Mission 2", "Mission 3", "Mission 4", "Mission 5", "Mission 6" ],
      "All Superyacht Life Missions": [ "Mission 1", "Mission 2", "Mission 3", "Mission 4", "Mission 5", "Mission 6" ],
      "All Project Overthrow Missions": [ "Mission 1", "Mission 2", "Mission 3", "Mission 4", "Mission 5", "Mission 6" ]
    }
  }
};


// --- DOM ELEMENTS ---
const inputs = {
    startReset: document.getElementById('startReset'),
    startSegment: document.getElementById('startSegment'),
    endSegment: document.getElementById('endSegment'),
    endRun: document.getElementById('endRun')
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
    if (!(parts.includes('Shift') && kb.key.length === 1 && kb.key.toUpperCase() !== kb.key)) {
        parts.push(displayKey);
    }
    return parts.join(' + ');
}

// --- PRESET MANAGEMENT LOGIC ---
function populateGroupDropdown() {
    presetGroupSelect.innerHTML = '';
    const groups = Object.keys(tempSettings.presets.data);
    if (groups.length === 0) {
        tempSettings.presets = JSON.parse(JSON.stringify(defaultPresets));
        populateGroupDropdown();
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
    a.download = 'ytsrt-presets.json';
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

function restoreOptions() {
    browser.storage.sync.get("settings").then((data) => {
        const s = data.settings;
        tempSettings = {
            keybindings: (s && s.keybindings) || JSON.parse(JSON.stringify(defaultKeybindings)),
            copyHeaderText: (s && typeof s.copyHeaderText !== 'undefined') ? s.copyHeaderText : "",
            presets: (s && s.presets && s.presets.data) ? s.presets : JSON.parse(JSON.stringify(defaultPresets))
        };
        for (const action in inputs) { inputs[action].value = formatKeybinding(tempSettings.keybindings[action]); }
        copyHeaderInput.value = tempSettings.copyHeaderText;
        populateGroupDropdown();
    });
}

function resetToDefaults() {
    if (!confirm("Are you sure you want to reset all settings to their defaults? This will erase all your presets.")) return;
    tempSettings = {
        keybindings: JSON.parse(JSON.stringify(defaultKeybindings)),
        copyHeaderText: "",
        presets: JSON.parse(JSON.stringify(defaultPresets))
    };
    saveOptions();
    restoreOptions();
}

document.addEventListener('DOMContentLoaded', restoreOptions);