import { db } from "./firebase.js";
import { ref, set, update, onValue, get, remove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    // UI Elements
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
    const nextWineBtn = document.getElementById("nextWineBtn");
    const prevWineBtn = document.getElementById("prevWineBtn");

    // Hulpfunctie: Check dubbelen
    async function getExistingOptions() {
        const snap = await get(ref(db, "dropdownOptions"));
        return snap.exists() ? snap.val() : {};
    }

    // 1. & 2. Optie opslaan & Bulk (Werkt nu altijd)
    const saveSingleOption = async (name, id = null) => {
        const cleanedName = name.trim();
        if (!cleanedName) return;
        const options = await getExistingOptions();
        const isDup = Object.entries(options).some(([k, v]) => v.name.toLowerCase() === cleanedName.toLowerCase() && k !== id);
        
        if (isDup) return; // Geen melding bij bulk, gewoon overslaan

        const targetId = id || Date.now() + Math.floor(Math.random() * 1000);
        await set(ref(db, `dropdownOptions/${targetId}`), { name: cleanedName });
    };

    saveOptionBtn.addEventListener("click", async () => {
        const name = optionInput.value;
        if (!name.trim()) return alert("Naam leeg");
        const options = await getExistingOptions();
        const isDup = Object.entries(options).some(([k, v]) => v.name.toLowerCase() === name.trim().toLowerCase() && k !== optionId.value);
        if (isDup) return alert("Bestaat al");

        await saveSingleOption(name, optionId.value || null);
        optionInput.value = ""; optionId.value = "";
        saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
    });

    bulkSaveBtn.addEventListener("click", async () => {
        const items = bulkOptionInput.value.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
        for (const item of items) { await saveSingleOption(item); }
        alert("Klaar!"); bulkOptionInput.value = "";
    });

    // 4. Wijn opslaan voor ronde (Werkt nu altijd)
    addWineBtn.addEventListener("click", async () => {
        const name = wineNameInput.value.trim() || masterGrapeSelect.value;
        const year = parseInt(wineYearInput.value);
        if (!name || !year) return alert("Naam en jaar verplicht");

        // Voeg toe aan dropdown als nieuw
        await saveSingleOption(name);

        const snap = await get(ref(db, "wines"));
        const currentWines = snap.exists() ? snap.val() : {};
        // Bepaal de volgende index op basis van de hoogste huidige index + 1
        const keys = Object.keys(currentWines).map(Number);
        const nextIdx = keys.length > 0 ? Math.max(...keys) + 1 : 1;

        await set(ref(db, `wines/${nextIdx}`), { grape: name, year, notes: wineNoteInput.value });
        wineNameInput.value = ""; wineYearInput.value = ""; wineNoteInput.value = "";
    });

    // 5. Volgende vrijgeven (Werkt ook bij 1 wijn)
    nextWineBtn.addEventListener("click", async () => {
        const settingsSnap = await get(ref(db, "settings/currentWine"));
        const current = settingsSnap.val() || 0;
        const next = current + 1;
        
        const wineSnap = await get(ref(db, `wines/${next}`));
        if (!wineSnap.exists()) return alert(`Ronde ${next} is nog niet aangemaakt in sectie 2!`);

        await update(ref(db, "settings"), { currentWine: next, status: "active" });
    });

    prevWineBtn.addEventListener("click", async () => {
        const settingsSnap = await get(ref(db, "settings/currentWine"));
        const current = settingsSnap.val() || 0;
        if (current > 1) {
            await update(ref(db, "settings"), { currentWine: current - 1, status: "active" });
        }
    });

    // Real-time lijst updates
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.entries(data).sort((a,b) => a[1].name.localeCompare(b[1].name));
        optionListDisplay.innerHTML = sorted.map(([id, val]) => `
            <div class="list-item">
                <span>${val.name}</span>
                <div class="list-item-buttons">
                    <button class="btn-small" onclick="window.editOpt('${id}','${val.name}')">✏️</button>
                    <button class="btn-small" style="background:red" onclick="window.delOpt('${id}')">🗑️</button>
                </div>
            </div>
        `).join("");
        masterGrapeSelect.innerHTML = '<option value="">-- Kies --</option>' + sorted.map(([id, val]) => `<option value="${val.name}">${val.name}</option>`).join("");
    });

    onValue(ref(db, "wines"), snap => {
        const w = snap.val() || {};
        let h = "<table><tr><th>#</th><th>Wijn</th><th>Actie</th></tr>";
        Object.keys(w).forEach(nr => h += `
            <tr>
                <td>${nr}</td>
                <td>${w[nr].grape} (${w[nr].year})</td>
                <td><button class="btn-small" style="background:red" onclick="window.delWine('${nr}')">🗑️</button></td>
            </tr>`);
        document.getElementById("wineListDisplay").innerHTML = h + "</table>";
    });

    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";
    });

    // Globals voor knoppen
    window.editOpt = (id, name) => { optionId.value = id; optionInput.value = name; saveOptionBtn.textContent = "Wijziging Opslaan"; };
    window.delOpt = async (id) => { if(confirm("Druif verwijderen?")) await remove(ref(db, `dropdownOptions/${id}`)); };
    window.delWine = async (nr) => { if(confirm("Ronde verwijderen?")) await remove(ref(db, `wines/${nr}`)); };

    // Resultaten & Resets
    document.getElementById("tempScoreBtn").onclick = () => alert("Bereken score via calcBtn logica...");
    document.getElementById("resetOptionsBtn").onclick = () => confirm("Hele lijst wissen?") && remove(ref(db, "dropdownOptions"));
    document.getElementById("resetWinesBtn").onclick = () => confirm("Alle rondes wissen?") && remove(ref(db, "wines"));
    document.getElementById("resetAnswersBtn").onclick = () => confirm("Antwoorden wissen?") && remove(ref(db, "answers"));
});