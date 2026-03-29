import { db, ref, onValue, update, get } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {

    const grapeSelect = document.getElementById("grapeSelect");
    const submitChoiceBtn = document.getElementById("submitChoiceBtn");
    const scoreValue = document.getElementById("scoreValue");
    const wineInfo = document.getElementById("wineInfo");

    // Realtime: druivenlijst
    onValue(ref(db, "dropdownOptions"), snap => {
        const data = snap.val() || {};
        const sorted = Object.values(data).sort((a, b) => a.name.localeCompare(b.name));

        grapeSelect.innerHTML =
            '<option value="">-- Kies --</option>' +
            sorted.map(o => `<option value="${o.name}">${o.name}</option>`).join("");
    });

    // Realtime: quiz status
    onValue(ref(db, "settings"), snap => {
        const s = snap.val() || {};
        document.getElementById("currentWineNumber").textContent = s.currentWine || 0;
        document.getElementById("quizStatusText").textContent = s.status || "wachten";

        wineInfo.classList.toggle("hidden", s.status !== "active");
    });

    // Score realtime
    onValue(ref(db, "scores/user1"), snap => {
        scoreValue.textContent = snap.exists() ? snap.val() : 0;
    });

    // Keuze doorgeven
    submitChoiceBtn.addEventListener("click", async () => {
        const choice = grapeSelect.value;
        if (!choice) {
            alert("Kies een druif.");
            return;
        }

        const settingsSnap = await get(ref(db, "settings"));
        const s = settingsSnap.val();
        const round = s.currentWine;

        await update(ref(db, `answers/user1`), {
            [round]: choice
        });

        alert("Keuze opgeslagen.");
    });
});
