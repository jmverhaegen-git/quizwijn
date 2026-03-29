import { db } from "./firebase.js";
import { ref, set, update, onValue, get, remove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    // UI Koppelingen
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

    // Hulpfunctie voor dubbelen
    async function getOptions() {
        const snap = await get(ref(db, "dropdownOptions"));
        return snap.exists() ? snap.val() : {};
    }

    // --- EXPORT FIX ---
    if (exportBtn) {
        exportBtn.addEventListener("click", async () => {
            try {
                const snap = await get(ref(db, "dropdownOptions"));
                if (!snap.exists()) {
                    alert("Er zijn geen druivensoorten om te exporteren.");
                    return;
                }
                
                const data = snap.val();
                const names = Object.values(data)
                    .map(o => o.name)
                    .filter(name => name) // Verwijder lege namen
                    .sort((a, b) => a.localeCompare(b))
                    .join("\r\n"); // Windowsvriendelijke nieuwe regel

                const blob = new Blob([names], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = url;
                a.download = `wijnlijst_${new Date().toLocaleDateString()}.txt`;
                document.body.appendChild(a);
                a.click();
                
                // Opruimen
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
            } catch (err) {
                console.error("Export fout:", err);
                alert("Export mislukt. Zie console voor details.");
            }
        });
    }

    // --- VOLGENDE VRIJGEVEN FIX ---
    if (nextWineBtn) {
        nextWineBtn.addEventListener("click", async () => {
            try {
                // Haal huidige status op
                const settingsSnap = await get(ref(db, "settings"));
                const settings = settingsSnap.exists() ? settingsSnap.val() : { currentWine: 0 };
                const current = settings.currentWine || 0;
                const next = current + 1;

                // Controleer of ronde bestaat
                const wineSnap = await get(ref(db, `wines/${next}`));
                
                if (!wineSnap.exists()) {
                    alert(`Kan niet naar ronde ${next}. Maak deze ronde eerst aan in Sectie 2.`);
                    return;
                }

                // Update settings
                await update(ref(db, "settings"), {
                    currentWine: next,
                    status: "active"
                });
            } catch (err) {
                console.error("Vrijgeven fout:", err);
                alert("Fout bij vrijgeven van volgende ronde.");
            }
        });
    }

    // --- OVERIGE LOGICA (DRUIF & WIJN OPSLAAN) ---
    const saveGrape = async (name, id = null) => {
        const cleaned = name.trim();
        if (!cleaned) return;
        const options = await getOptions();
        const exists = Object.entries(options).some(([k, v]) => v.name.toLowerCase() === cleaned.toLowerCase() && k !== id);
        if (exists) return id ? alert("Naam bestaat al") : null;

        const targetId = id || Date.now() + Math.floor(Math.random() * 1000);
        await set(ref(db, `dropdownOptions/${targetId}`), { name: cleaned });
    };

    saveOptionBtn.addEventListener("click", () => {
        saveGrape(optionInput.value, optionId.value || null);
        optionInput.value = ""; optionId.value = "";
        saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
    });

    addWineBtn.addEventListener("click", async () => {
        const name = wineNameInput.value.trim() || masterGrapeSelect.value;
        const year = parseInt(wineYearInput.value);
        if (!name || !year) return alert("Naam en jaar zijn verplicht.");

        await saveGrape(name); // Voeg toe aan dropdown indien nieuw

        const wineSnap = await get(ref(db, "wines"));
        const currentWines = wineSnap.exists() ? wineSnap.val() : {};
        const keys = Object.keys(currentWines).map(Number);
        const nextNr = keys.length > 0 ? Math.max(...keys) + 1 : 1;

        await set(ref(db, `wines/${nextNr}`), { grape: name, year: year, notes: wineNoteInput.value });
        wineNameInput.value = ""; wineYearInput.value = ""; wineNoteInput.value = "";
    });

    // Real-time listeniers
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.entries(data).sort((a,b) => a[1].name.localeCompare(b[1].name));
        optionListDisplay.innerHTML = sorted.map(([id, val]) => `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;">
                <span>${val.name}</span>
                <div>
                    <button class="btn-small" onclick="window.editOpt('${id}','${val.name}')">✏️</button>
                    <button class="btn-small" style="background:red" onclick="window.delOpt('${id}')">🗑️</button>
                </div>
            </div>`).join("");
        masterGrapeSelect.innerHTML = '<option value="">-- Kies --</option>' + sorted.map(([id, val]) => `<option value="${val.name}">${val.name}</option>`).join("");
    });

    onValue(ref(db, "wines"), snap => {
        const w = snap.val() || {};
        let h = "<table><tr><th>#</th><th>Wijn</th><th>Actie</th></tr>";
        Object.keys(w).forEach(nr => h += `<tr><td>${nr}</td><td>${w[nr].grape} (${w[nr].year})</td><td><button class="btn-small" style="background:red" onclick="window.delWine('${nr}')">🗑️</button></td></tr>`);
        document.getElementById("wineListDisplay").innerHTML = h + "</table>";
    });

    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";
    });

    // Globale functies
    window.editOpt = (id, n) => { optionId.value = id; optionInput.value = n; saveOptionBtn.textContent = "Wijzigen"; };
    window.delOpt = (id) => confirm("Wissen?") && remove(ref(db, `dropdownOptions/${id}`));
    window.delWine = (nr) => confirm("Ronde wissen?") && remove(ref(db, `wines/${nr}`));
});