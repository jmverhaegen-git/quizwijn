import { db } from "./firebase.js";
import { ref, set, update, onValue, get } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const loginScreen = document.getElementById("loginScreen"), quizScreen = document.getElementById("quizScreen"),
      resultScreen = document.getElementById("resultScreen"), waiting = document.getElementById("waiting"),
      scoreInput = document.getElementById("scoreInput"), scoreValueDisplay = document.getElementById("scoreValueDisplay");

let userName = "", currentWine = 0;

scoreInput.addEventListener('input', () => { scoreValueDisplay.textContent = scoreInput.value; });

// Dropdown vullen
onValue(ref(db, "dropdownOptions"), snap => {
    const sorted = Object.values(snap.val() || {}).sort((a,b) => a.name.localeCompare(b.name));
    let html = '<option value="">-- Maak een keuze --</option>';
    sorted.forEach(opt => html += `<option value="${opt.name}">${opt.name}</option>`);
    document.getElementById("grapeSelect").innerHTML = html;
});

document.getElementById("startBtn").onclick = () => {
    userName = document.getElementById("nameInput").value.trim();
    if (!userName) return alert("Naam verplicht");
    update(ref(db, `participants/${userName}`), { ingelogd: true });
    loginScreen.classList.add("hidden"); quizScreen.classList.remove("hidden");
};

onValue(ref(db, "settings"), async (snap) => {
    const s = snap.val() || {};
    const newWine = s.currentWine || 0;
    if (s.status === "finished") {
        await toonOverzicht(newWine, true);
    } else if (newWine !== currentWine && newWine > 0) {
        if (currentWine !== 0 && newWine > currentWine) {
            await toonOverzicht(newWine - 1, false);
            setTimeout(() => resetRonde(newWine), 8000);
        } else {
            resetRonde(newWine);
        }
        currentWine = newWine;
    }
});

async function toonOverzicht(tot, einde) {
    const wines = (await get(ref(db, "wines"))).val() || {};
    let html = "<h3>Jouw resultaten:</h3>";
    for (let i = 1; i <= tot; i++) {
        const correct = wines[i], gokSnap = await get(ref(db, `answers/${i}/${userName}`));
        const gok = gokSnap.val() || { grape: "Geen", year: 0, score: 0 };
        let pts = (gok.grape.toLowerCase() === (correct.grape||"").toLowerCase()) ? 5 : 0;
        if (pts === 5 && Math.abs(gok.year - correct.year) <= 1) pts += 2;
        html += `<div style="border-bottom:1px dotted #ccc; padding:8px;"><strong>Ronde ${i}:</strong> ${correct.grape} (${correct.year})<br>Jouw gok: ${gok.grape} (${gok.year}) | Punten: ${pts}</div>`;
    }
    document.getElementById("resultBox").innerHTML = html;
    quizScreen.classList.add("hidden"); waiting.classList.add("hidden"); resultScreen.classList.remove("hidden");
    if (einde) document.getElementById("finalMsg").classList.remove("hidden");
}

function resetRonde(nr) {
    document.getElementById("wineTitle").textContent = `Wijn ${nr}`;
    document.getElementById("yearInput").value = "";
    document.getElementById("customGrapeInput").value = "";
    document.getElementById("grapeSelect").value = "";
    scoreInput.value = 5; scoreValueDisplay.textContent = 5;
    resultScreen.classList.add("hidden"); waiting.classList.add("hidden"); quizScreen.classList.remove("hidden");
}

// Fix 4: Bevestiging met jaartal
document.getElementById("submitBtn").onclick = () => {
    const grape = document.getElementById("customGrapeInput").value.trim() || document.getElementById("grapeSelect").value;
    const year = parseInt(document.getElementById("yearInput").value) || 0;
    const score = parseInt(scoreInput.value);
    if (!grape) return alert("Selecteer een wijn");

    set(ref(db, `answers/${currentWine}/${userName}`), { grape, year, score });

    document.getElementById("submissionSummary").innerHTML = `
        <p><strong>Wijn ronde:</strong> ${currentWine}</p>
        <p><strong>Ingegeven wijn:</strong> ${grape}</p>
        <p><strong>Ingegeven jaartal:</strong> ${year > 0 ? year : 'Niet ingevuld'}</p>
        <p><strong>Jouw smaakscore:</strong> ${score}/10</p>`;
    
    quizScreen.classList.add("hidden"); waiting.classList.remove("hidden");
};