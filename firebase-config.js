
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWwuRtYbTFBE2_KfEQhYxqFgdN9ugXOpc",
    authDomain: "sidahmedcar-6a428.firebaseapp.com",
    databaseURL: "https://sidahmedcar-6a428-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "sidahmedcar-6a428",
    storageBucket: "sidahmedcar-6a428.firebasestorage.app",
    messagingSenderId: "257186928455",
    appId: "1:257186928455:web:d10cfb041c65f10d4c1e62"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
