// Firebase SDK Imports
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
    getDatabase, ref, set, update, onValue, get, remove 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// JOUW SPECIFIEKE CONFIGURATIE
const firebaseConfig = {
    apiKey: "JOUW_API_KEY",
    authDomain: "jouw-project.firebaseapp.com",
    databaseURL: "https://jouw-project-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jouw-project-id",
    storageBucket: "jouw-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Initialiseer Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exporteer alles voor gebruik in andere modules
export { db, ref, set, update, onValue, get, remove };
