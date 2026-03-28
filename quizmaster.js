import { db } from "./firebase.js";
import { ref, set, update, onValue, get, remove } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    // Koppelingen naar elementen
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
    const calcBtn = document.getElementById("calcBtn");
    const tempScoreBtn = document.getElementById("tempScoreBtn");

    // --- HULPFUNCTIE: DUBBEL-CHECK ---
    async function isDubbel(naam, huidigeId = null) {
        const snap = await get(ref(db, "dropdownOptions"));
        if (!snap.exists()) return false;
        const data = snap.val();
        return Object.entries(data).some(([id, val]) => 
            val.name.toLowerCase() === naam.toLowerCase() && id !== huidigeId
        );
    }

    // --- 1. BEHEER DROPDOWN ---
    saveOptionBtn.addEventListener("click", async () => {
        const name = optionInput.value.trim();
        const id = optionId.value;
        if (!name) return alert("Vul een naam in");
        if (await isDubbel(name, id)) return alert("Deze soort bestaat al.");

        if (id) {
            await update(ref(db, `dropdownOptions/${id}`), { name });
        } else {
            await set(ref(db, `dropdownOptions/${Date.now()}`), { name });
        }
        optionInput.value = ""; optionId.value = "";
        saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
    });

    // --- BULK / IMPORT ---
    async function verwerkBulk(tekst) {
        if (!tekst.trim()) return;
        const items = tekst.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
        const snap = await get(ref(db, "dropdownOptions"));
        let bestaande = snap.exists() ? Object.values(snap.val()).map(o => o.name.toLowerCase()) : [];
        let tellertje = 0;
        for (const n of items) {
            if (!bestaande.includes(n.toLowerCase())) {
                const nieuwId = Date.now() + Math.floor(Math.random() * 1000);
                await set(ref(db, `dropdownOptions/${nieuwId}`), { name: n });
                bestaande.push(n.toLowerCase());
                tellertje++;
            }
        }
        alert(`${tellertje} toegevoegd.`);
        bulkOptionInput.value = "";
    }

    bulkSaveBtn.addEventListener("click", () => verwerkBulk(bulkOptionInput.value));
    exportBtn.addEventListener("click", async () => {
        const snap = await get(ref(db, "dropdownOptions"));
        const lijst = Object.values(snap.val() || {}).map(o => o.name).sort().join("\n");
        const blob = new Blob([lijst], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "wijnlijst.txt";
        a.click();
    });
    importFileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => verwerkBulk(ev.target.result);
        reader.readAsText(e.target.files[0]);
    });

    // --- 2. WIJN RONDES ---
    addWineBtn.addEventListener("click", async () => {
        const naam = wineNameInput.value.trim() || masterGrapeSelect.value;
        const jaar = wineYearInput.value;
        if (!naam || !jaar) return alert("Vul naam en jaar in");

        if (wineNameInput.value.trim() && !(await isDubbel(naam))) {
            await set(ref(db, `dropdownOptions/${Date.now()}`), { name: naam });
        }

        const snap = await get(ref(db, "wines"));
        const nr = snap.exists() ? Math.max(...Object.keys(snap.val()).map(Number)) + 1 : 1;
        await set(ref(db, `wines/${nr}`), { grape: naam, year: parseInt(jaar), notes: wineNoteInput.value });
        wineNameInput.value = ""; wineYearInput.value = ""; wineNoteInput.value = "";
    });

    // --- 3. LIVE BESTURING (FIXED) ---
    nextWineBtn.addEventListener("click", async () => {
        const snap = await get(ref(db, "settings/currentWine"));
        const next = (snap.val() || 0) + 1;
        const check = await get(ref(db, `wines/${next}`));
        if (!check.exists()) return alert("Ronde " + next + " is nog niet ingesteld!");
        
        await update(ref(db, "settings"), { currentWine: next, status: "active" });
    });

    prevWineBtn.addEventListener("click", async () => {
        const snap = await get(ref(db, "settings/currentWine"));
        const cur = snap.val() || 0;
        if (cur > 1) {
            await update(ref(db, "settings"), { currentWine: cur - 1, status: "active" });
        }
    });

    // --- 4. RESULTATEN ---
    async function bereken(einde) {
        if (einde) await update(ref(db, "settings"), { status: "finished" });
        const wines = (await get(ref(db, "wines"))).val() || {};
        const answers = (await get(ref(db, "answers"))).val() || {};
        const participants = (await get(ref(db, "participants"))).val() || {};
        let result = [];
        Object.keys(participants).forEach(p => {
            let score = 0;
            for (let wId in answers) {
                const cor = wines[wId]; const gok = answers[wId][p];
                if (cor && gok) {
                    let pts = (gok.grape.toLowerCase() === cor.grape.toLowerCase()) ? 5 : 0;
                    if (pts === 5 && Math.abs(gok.year - cor.year) <= 1) pts += 2;
                    score += pts;
                }
            }
            result.push({ name: p, score });
        });
        result.sort((a,b) => b.score - a.score);
        document.getElementById("scoreTable").innerHTML = `<h3>${einde ? 'Eindstand' : 'Tussenstand'}</h3>` + 
            result.map(r => `<p>${r.name}: <strong>${r.score} ptn</strong></p>`).join("");
    }

    calcBtn.addEventListener("click", () => bereken(true));
    tempScoreBtn.addEventListener("click", () => bereken(false));

    // --- REALTIME UPDATES ---
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.entries(data).sort((a,b) => a[1].name.localeCompare(b[1].name));
        optionListDisplay.innerHTML = "<ul>" + sorted.map(([id, val]) => `
            <li>${val.name} <button onclick="window.editOpt('${id}','${val.name}')">✏️</button>
            <button onclick="window.delOpt('${id}','${val.name}')">🗑️</button></li>`).join("") + "</ul>";
        masterGrapeSelect.innerHTML = '<option value="">-- Kies --</option>' + 
            sorted.map(([id, val]) => `<option value="${val.name}">${val.name}</option>`).join("");
    });

    onValue(ref(db, "wines"), snap => {
        const w = snap.val() || {};
        let h = "<table><tr><th>#</th><th>Wijn</th></tr>";
        Object.keys(w).forEach(nr => h += `<tr><td>${nr}</td><td>${w[nr].grape}</td></tr>`);
        document.getElementById("wineListDisplay").innerHTML = h + "</table>";
    });

    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";
    });

    // Globals voor lijst-knoppen
    window.editOpt = (id, n) => { optionId.value = id; optionInput.value = n; saveOptionBtn.textContent = "Wijzigen"; };
    window.delOpt = async (id, n) => { if(confirm("Wis " + n + "?")) await remove(ref(db, `dropdownOptions/${id}`)); };

    // Resets
    document.getElementById("resetAnswersBtn").addEventListener("click", () => { if(confirm("Wis antwoorden?")) { remove(ref(db,"answers")); update(ref(db,"settings"),{currentWine:0,status:"waiting"}); }});
    document.getElementById("resetParticipantsBtn").addEventListener("click", () => { if(confirm("Wis spelers?")) remove(ref(db,"participants")); });
    document.getElementById("resetWinesBtn").addEventListener("click", () => { if(confirm("Wis rondes?")) remove(ref(db,"wines")); });
    document.getElementById("resetOptionsBtn").addEventListener("click", () => { if(confirm("Wis lijst?")) remove(ref(db,"dropdownOptions")); });
});