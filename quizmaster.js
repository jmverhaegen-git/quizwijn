import { db } from "./firebase.js";
import { ref, set, update, onValue, get, remove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Elementen koppelen
const optionId = document.getElementById("optionId");
const optionInput = document.getElementById("optionInput");
const saveOptionBtn = document.getElementById("saveOptionBtn");
const optionListDisplay = document.getElementById("optionListDisplay");
const bulkOptionInput = document.getElementById("bulkOptionInput");
const bulkSaveBtn = document.getElementById("bulkSaveBtn");
const exportBtn = document.getElementById("exportBtn");
const importFileBtn = document.getElementById("importFileBtn");
const fileInput = document.getElementById("fileInput");

const masterGrapeSelect = document.getElementById("masterGrapeSelect");
const wineNameInput = document.getElementById("wineNameInput");
const wineYearInput = document.getElementById("wineYearInput");
const wineNoteInput = document.getElementById("wineNoteInput");
const addWineBtn = document.getElementById("addWineBtn");
const wineListDisplay = document.getElementById("wineListDisplay");

const currentWineNumber = document.getElementById("currentWineNumber");
const quizStatusText = document.getElementById("quizStatusText");
const nextWineBtn = document.getElementById("nextWineBtn");
const prevWineBtn = document.getElementById("prevWineBtn");
const calcBtn = document.getElementById("calcBtn");
const tempScoreBtn = document.getElementById("tempScoreBtn");
const scoreTable = document.getElementById("scoreTable");

// --- 1. DROPDOWN BEHEER (ENKELE INVOER) ---
saveOptionBtn.addEventListener('click', async () => {
    const name = optionInput.value.trim();
    const id = optionId.value;
    if (!name) return alert("Vul een naam in");

    const snap = await get(ref(db, "dropdownOptions"));
    const existing = snap.exists() ? Object.entries(snap.val()) : [];
    
    // Dubbel check (behalve als we de huidige ID bewerken)
    const isDuplicate = existing.some(([key, val]) => val.name.toLowerCase() === name.toLowerCase() && key !== id);
    if (isDuplicate) return alert("Deze druivensoort bestaat al.");

    if (id) {
        await update(ref(db, `dropdownOptions/${id}`), { name });
    } else {
        await set(ref(db, `dropdownOptions/${Date.now()}`), { name });
    }
    
    optionInput.value = ""; 
    optionId.value = "";
    saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
});

// --- BULK & IMPORT LOGICA ---
async function verwerkBulk(tekst) {
    if (!tekst) return alert("Geen tekst gevonden.");
    
    // Split op komma of nieuwe regel
    const items = tekst.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
    if (items.length === 0) return alert("Geen geldige soorten gevonden.");

    const snap = await get(ref(db, "dropdownOptions"));
    let existingNames = snap.exists() ? Object.values(snap.val()).map(o => o.name.toLowerCase()) : [];

    let addedCount = 0;
    for (const name of items) {
        if (!existingNames.includes(name.toLowerCase())) {
            const tempId = Date.now() + Math.floor(Math.random() * 1000);
            await set(ref(db, `dropdownOptions/${tempId}`), { name });
            existingNames.push(name.toLowerCase());
            addedCount++;
        }
    }
    alert(`${addedCount} nieuwe soort(en) toegevoegd. Dubbelen zijn genegeerd.`);
    bulkOptionInput.value = "";
}

bulkSaveBtn.addEventListener('click', () => verwerkBulk(bulkOptionInput.value));

// EXPORT
exportBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, "dropdownOptions"));
    if (!snap.exists()) return alert("Geen data om te exporteren.");
    const names = Object.values(snap.val()).map(o => o.name).sort().join("\n");
    const blob = new Blob([names], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "druivensoorten_export.txt";
    a.click();
});

// IMPORT
importFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => verwerkBulk(ev.target.result);
    reader.readAsText(file);
    fileInput.value = ""; 
});

// Real-time lijst tonen
onValue(ref(db, "dropdownOptions"), snap => {
    const options = snap.val() || {};
    const sortedKeys = Object.keys(options).sort((a,b) => options[a].name.localeCompare(options[b].name));
    
    let html = "<ul>";
    sortedKeys.forEach(k => {
        const n = options[k].name;
        html += `<li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:3px;">
            <span>${n}</span>
            <div>
                <button onclick="editOption('${k}','${n}')" style="width:auto; padding:2px 8px; font-size:0.8em; background:#6c757d;">✏️</button> 
                <button onclick="deleteOption('${k}','${n}')" style="width:auto; padding:2px 8px; font-size:0.8em; background:red;">🗑️</button>
            </div>
        </li>`;
    });
    optionListDisplay.innerHTML = html + "</ul>";

    const sortedValues = Object.values(options).sort((a,b) => a.name.localeCompare(b.name));
    masterGrapeSelect.innerHTML = '<option value="">-- Kies bestaand --</option>' + 
        sortedValues.map(o => `<option value="${o.name}">${o.name}</option>`).join("");
});

// Globale functies voor knoppen in de lijst
window.editOption = (id, name) => {
    optionId.value = id; 
    optionInput.value = name;
    saveOptionBtn.textContent = "Wijziging Opslaan";
};

window.deleteOption = async (id, name) => {
    const winesSnap = await get(ref(db, "wines"));
    const isUsed = Object.values(winesSnap.val() || {}).some(w => w.grape === name);
    if (isUsed) return alert("Kan niet verwijderen: deze soort wordt gebruikt in een ronde.");
    if (confirm(`'${name}' verwijderen?`)) await remove(ref(db, `dropdownOptions/${id}`));
};

// --- 2. WIJN RONDES ---
addWineBtn.addEventListener('click', async () => {
    const finalName = wineNameInput.value.trim() || masterGrapeSelect.value;
    const year = parseInt(wineYearInput.value);
    if (!finalName || !year) return alert("Naam en jaar verplicht");

    // Automatisch toevoegen aan dropdown als het een nieuwe naam is
    const check = await get(ref(db, "dropdownOptions"));
    const exists = Object.values(check.val() || {}).some(o => o.name.toLowerCase() === finalName.toLowerCase());
    if (!exists) await set(ref(db, `dropdownOptions/${Date.now()}`), { name: finalName });

    const snap = await get(ref(db, "wines"));
    const idx = snap.exists() ? Math.max(...Object.keys(snap.val()).map(Number)) + 1 : 1;
    await set(ref(db, `wines/${idx}`), { grape: finalName, year, notes: wineNoteInput.value });
    
    wineNameInput.value = ""; wineYearInput.value = ""; wineNoteInput.value = "";
});

onValue(ref(db, "wines"), snap => {
    const wines = snap.val() || {};
    let html = "<table style='width:100%'><tr><th>#</th><th>Wijn</th><th>Jaar</th></tr>";
    Object.keys(wines).forEach(id => html += `<tr><td>${id}</td><td>${wines[id].grape}</td><td>${wines[id].year}</td></tr>`);
    wineListDisplay.innerHTML = html + "</table>";
});

// --- 3. LIVE BESTURING ---
nextWineBtn.onclick = async () => {
    const snap = await get(ref(db, "settings/currentWine"));
    const next = (snap.val() || 0) + 1;
    if (!(await get(ref(db, `wines/${next}`))).exists()) return alert("Ronde " + next + " is niet ingesteld.");
    update(ref(db, "settings"), { currentWine: next, status: "active" });
};

prevWineBtn.onclick = async () => {
    const snap = await get(ref(db, "settings/currentWine"));
    const prev = (snap.val() || 0) - 1;
    if (prev < 1) return;
    update(ref(db, "settings"), { currentWine: prev, status: "active" });
};

onValue(ref(db, "settings"), snap => {
    const s = snap.val() || {};
    currentWineNumber.textContent = s.currentWine || 0;
    quizStatusText.textContent = s.status || "In afwachting";
});

// --- 4. SCORE ---
async function bereken(isEinde) {
    if (isEinde) await update(ref(db, "settings"), { status: "finished" });
    const wines = (await get(ref(db, "wines"))).val() || {};
    const answers = (await get(ref(db, "answers"))).val() || {};
    const participants = (await get(ref(db, "participants"))).val() || {};
    let scores = [];
    Object.keys(participants).forEach(pName => {
        let total = 0;
        for (let wId in answers) {
            const correct = wines[wId];
            const gok = answers[wId][pName];
            if (correct && gok) {
                let pts = (gok.grape.toLowerCase() === correct.grape.toLowerCase()) ? 5 : 0;
                if (pts === 5 && Math.abs(gok.year - correct.year) <= 1) pts += 2;
                total += pts;
            }
        }
        scores.push({ name: pName, total });
    });
    scores.sort((a,b) => b.total - a.total);
    scoreTable.innerHTML = `<h3>${isEinde ? 'Einduitslag' : 'Tussenstand'}</h3><table border="1" style="width:100%">` + 
        scores.map(s => `<tr><td>${s.name}</td><td><strong>${s.total} pts</strong></td></tr>`).join("") + "</table>";
}

calcBtn.onclick = () => bereken(true);
tempScoreBtn.onclick = () => bereken(false);

// --- RESETS ---
document.getElementById("resetAnswersBtn").onclick = () => { if(confirm("Antwoorden wissen?")) { remove(ref(db, "answers")); update(ref(db, "settings"), {currentWine:0, status:"waiting"}); }};
document.getElementById("resetParticipantsBtn").onclick = () => { if(confirm("Deelnemers wissen?")) remove(ref(db, "participants")); };
document.getElementById("resetWinesBtn").onclick = () => { if(confirm("Wijnrondes wissen?")) { remove(ref(db, "wines")); update(ref(db, "settings"), {currentWine:0}); }};
document.getElementById("resetOptionsBtn").onclick = () => { if(confirm("Dropdown-lijst VOLLEDIG wissen?")) remove(ref(db, "dropdownOptions")); };