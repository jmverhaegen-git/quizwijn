import { db, ref, set, update, onValue, get, remove } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {

    // UI ELEMENTEN
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

    // VEILIGE ESCAPE FUNCTIE
    function esc(str) {
        return str.replace(/[&<>"']/g, m => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[m]));
    }

    // HULPFUNCTIE
    async function getOptions() {
        const snap = await get(ref(db, "dropdownOptions"));
        return snap.exists() ? snap.val() : {};
    }

    // OPSLAAN / WIJZIGEN DRUIF
    const saveGrape = async (name, id = null) => {
        const cleaned = name.trim();
        if (!cleaned) return;

        const options = await getOptions();
        const exists = Object.entries(options)
            .some(([k, v]) => v.name.toLowerCase() === cleaned.toLowerCase() && k !== id);

        if (exists) {
            alert("Naam bestaat al.");
            return;
        }

        const targetId = id || Date.now() + Math.floor(Math.random() * 1000);
        await set(ref(db, `dropdownOptions/${targetId}`), { name: cleaned });
    };

    // KNOP: Opslaan druif
    saveOptionBtn.addEventListener("click", async () => {
        await saveGrape(optionInput.value, optionId.value || null);
        optionInput.value = "";
        optionId.value = "";
        saveOptionBtn.textContent = "Optie Opslaan / Wijzigen";
    });

    // KNOP: Exporteren
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
                    .filter(n => n)
                    .sort((a, b) => a.localeCompare(b))
                    .join("\r\n");

                const blob = new Blob([names], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `wijnlijst_${new Date().toLocaleDateString()}.txt`;
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

            } catch (err) {
                console.error("Export fout:", err);
                alert("Export mislukt.");
            }
        });
    }

    // KNOP: Volgende ronde vrijgeven
    if (nextWineBtn) {
        nextWineBtn.addEventListener("click", async () => {
            try {
                const settingsSnap = await get(ref(db, "settings"));
                const settings = settingsSnap.exists() ? settingsSnap.val() : { currentWine: 0 };
                const current = settings.currentWine || 0;
                const next = current + 1;

                const wineSnap = await get(ref(db, `wines/${next}`));
                if (!wineSnap.exists()) {
                    alert(`Ronde ${next} bestaat nog niet.`);
                    return;
                }

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

    // KNOP: Wijn toevoegen
    addWineBtn.addEventListener("click", async () => {
        const name = wineNameInput.value.trim() || masterGrapeSelect.value;
        const year = parseInt(wineYearInput.value);

        if (!name || !year) {
            alert("Naam en jaar zijn verplicht.");
            return;
        }

        await saveGrape(name);

        const wineSnap = await get(ref(db, "wines"));
        const currentWines = wineSnap.exists() ? wineSnap.val() : {};
        const keys = Object.keys(currentWines).map(Number);
        const nextNr = keys.length > 0 ? Math.max(...keys) + 1 : 1;

        await set(ref(db, `wines/${nextNr}`), {
            grape: name,
            year: year,
            notes: wineNoteInput.value
        });

        wineNameInput.value = "";
        wineYearInput.value = "";
        wineNoteInput.value = "";
    });

    // REALTIME LISTENERS
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.entries(data)
            .sort((a, b) => a[1].name.localeCompare(b[1].name));

        optionListDisplay.innerHTML = sorted.map(([id, val]) => `
            <div class="opt-row" data-id="${id}">
                <span>${esc(val.name)}</span>
                <div>
                    <button class="btn-edit" data-id="${id}" data-name="${esc(val.name)}">✏️</button>
                    <button class="btn-del" data-id="${id}">🗑️</button>
                </div>
            </div>
        `).join("");

        masterGrapeSelect.innerHTML =
            '<option value="">-- Kies --</option>' +
            sorted.map(([id, val]) =>
                `<option value="${esc(val.name)}">${esc(val.name)}</option>`
            ).join("");
    });

    onValue(ref(db, "wines"), snap => {
        const w = snap.val() || {};
        let h = "<table><tr><th>#</th><th>Wijn</th><th>Actie</th></tr>";

        Object.keys(w).forEach(nr => {
            h += `
                <tr>
                    <td>${nr}</td>
                    <td>${esc(w[nr].grape)} (${w[nr].year})</td>
                    <td><button class="btn-del-wine" data-nr="${nr}">🗑️</button></td>
                </tr>`;
        });

        document.getElementById("wineListDisplay").innerHTML = h + "</table>";
    });

    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";
    });

    // EVENT DELEGATION (veilig & modern)
    document.body.addEventListener("click", e => {
        if (e.target.classList.contains("btn-edit")) {
            optionId.value = e.target.dataset.id;
            optionInput.value = e.target.dataset.name;
            saveOptionBtn.textContent = "Wijzigen";
        }

        if (e.target.classList.contains("btn-del")) {
            const id = e.target.dataset.id;
            if (confirm("Wissen?")) remove(ref(db, `dropdownOptions/${id}`));
        }

        if (e.target.classList.contains("btn-del-wine")) {
            const nr = e.target.dataset.nr;
            if (confirm("Ronde wissen?")) remove(ref(db, `wines/${nr}`));
        }
    });
});
