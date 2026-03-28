import { db } from "./firebase.js";
import { ref, set, update, onValue, get, remove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Wacht tot alle elementen geladen zijn
document.addEventListener("DOMContentLoaded", () => {

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

    // --- HULPFUNCTIE: CONTROLEER DUBBELEN ---
    async function isDubbel(naam, huidigeId = null) {
        const snap = await get(ref(db, "dropdownOptions"));
        if (!snap.exists()) return false;
        const options = snap.val();
        return Object.entries(options).some(([id, val]) => 
            val.name.toLowerCase() === naam.toLowerCase() && id !== huidigeId
        );
    }

    // --- 1. ENKELE OPTIE OPSLAAN ---
    if (saveOptionBtn) {
        saveOptionBtn.addEventListener("click", async () => {
            const name = optionInput.value.trim();
            const id = optionId.value;
            if (!name) return alert("Vul een naam in");

            if (await isDubbel(name, id)) {
                return alert("Deze druivensoort bestaat al.");
            }

            if (id) {
                await update(ref(db, `dropdownOptions/${id}`), { name });
            } else {
                await set(ref(db, `dropdownOptions/${Date.now()}`), { name });
            }
            optionInput.value = ""; optionId.value = "";
            saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
        });
    }

    // --- 2. BULK INVOER LOGICA ---
    async function verwerkBulk(tekst) {
        if (!tekst.trim()) return alert("Voer tekst in.");
        const items = tekst.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
        
        const snap = await get(ref(db, "dropdownOptions"));
        let bestaandeNamen = snap.exists() ? Object.values(snap.val()).map(o => o.name.toLowerCase()) : [];

        let toegevoegd = 0;
        for (const naam of items) {
            if (!bestaandeNamen.includes(naam.toLowerCase())) {
                const nieuwId = Date.now() + Math.floor(Math.random() * 1000);
                await set(ref(db, `dropdownOptions/${nieuwId}`), { name: naam });
                bestaandeNamen.push(naam.toLowerCase());
                toegevoegd++;
            }
        }
        alert(`${toegevoegd} soorten toegevoegd. Dubbelen overgeslagen.`);
        bulkOptionInput.value = "";
    }

    if (bulkSaveBtn) {
        bulkSaveBtn.addEventListener("click", () => verwerkBulk(bulkOptionInput.value));
    }

    // --- 3. IMPORT / EXPORT ---
    if (exportBtn) {
        exportBtn.addEventListener("click", async () => {
            const snap = await get(ref(db, "dropdownOptions"));
            if (!snap.exists()) return alert("Geen data.");
            const lijst = Object.values(snap.val()).map(o => o.name).sort().join("\n");
            const blob = new Blob([lijst], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "wijnlijst.txt";
            a.click();
        });
    }

    if (importFileBtn) {
        importFileBtn.addEventListener("click", () => fileInput.click());
    }
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => verwerkBulk(ev.target.result);
            reader.readAsText(file);
        });
    }

    // --- 4. DATA LADEN (DROPDOWN & LIJST) ---
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.entries(data).sort((a,b) => a[1].name.localeCompare(b[1].name));
        
        // Update beheerlijst
        optionListDisplay.innerHTML = "<ul>" + sorted.map(([id, val]) => `
            <li style="display:flex; justify-content:space-between; margin-bottom:5px;">
                ${val.name}
                <div>
                    <button onclick="window.editOpt('${id}', '${val.name}')" style="width:auto; padding:2px 5px; background:#6c757d; font-size:0.8em;">✏️</button>
                    <button onclick="window.delOpt('${id}', '${val.name}')" style="width:auto; padding:2px 5px; background:red; font-size:0.8em;">🗑️</button>
                </div>
            </li>
        `).join("") + "</ul>";

        // Update select box voor ronde-instelling
        masterGrapeSelect.innerHTML = '<option value="">-- Kies bestaand --</option>' + 
            sorted.map(([id, val]) => `<option value="${val.name}">${val.name}</option>`).join("");
    });

    // Globale window functies voor knoppen in de lijst
    window.editOpt = (id, naam) => {
        optionId.value = id;
        optionInput.value = naam;
        saveOptionBtn.textContent = "Wijziging Opslaan";
    };

    window.delOpt = async (id, naam) => {
        if (confirm(`Verwijder ${naam}?`)) await remove(ref(db, `dropdownOptions/${id}`));
    };

    // --- 5. RONDES & LIVE BESTURING ---
    if (addWineBtn) {
        addWineBtn.addEventListener("click", async () => {
            const naam = wineNameInput.value.trim() || masterGrapeSelect.value;
            const jaar = wineYearInput.value;
            if (!naam || !jaar) return alert("Naam en jaar verplicht");

            // Automatisch toevoegen aan lijst als het een nieuwe getypte naam is
            if (wineNameInput.value.trim() && !(await isDubbel(naam))) {
                await set(ref(db, `dropdownOptions/${Date.now()}`), { name: naam });
            }

            const snap = await get(ref(db, "wines"));
            const nr = snap.exists() ? Math.max(...Object.keys(snap.val()).map(Number)) + 1 : 1;
            await set(ref(db, `wines/${nr}`), { grape: naam, year: parseInt(jaar), notes: wineNoteInput.value });
            
            wineNameInput.value = ""; wineYearInput.value = ""; wineNoteInput.value = "";
        });
    }

    // Overige onValue listeners voor UI updates
    onValue(ref(db, "wines"), snap => {
        const wines = snap.val() || {};
        let h = "<table><tr><th>#</th><th>Wijn</th><th>Jaar</th></tr>";
        Object.keys(wines).forEach(nr => h += `<tr><td>${nr}</td><td>${wines[nr].grape}</td><td>${wines[nr].year}</td></tr>`);
        document.getElementById("wineListDisplay").innerHTML = h + "</table>";
    });

    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";
    });

    // Besturingsknoppen
    document.getElementById("nextWineBtn").onclick = async () => {
        const snap = await get(ref(db, "settings/currentWine"));
        const next = (snap.val() || 0) + 1;
        const check = await get(ref(db, `wines/${next}`));
        if (!check.exists()) return alert("Ronde niet ingesteld.");
        update(ref(db, "settings"), { currentWine: next, status: "active" });
    };

    document.getElementById("prevWineBtn").onclick = async () => {
        const snap = await get(ref(db, "settings/currentWine"));
        const cur = snap.val() || 0;
        if (cur > 1) update(ref(db, "settings"), { currentWine: cur - 1, status: "active" });
    };

    // Resets
    document.getElementById("resetOptionsBtn").onclick = () => { if(confirm("Lijst wissen?")) remove(ref(db, "dropdownOptions")); };
    document.getElementById("resetWinesBtn").onclick = () => { if(confirm("Rondes wissen?")) remove(ref(db, "wines")); };
    // ... voeg hier eventueel de overige resets toe indien nodig
});