// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCdqdaq7v4wocSVVVReTHqd_IUTrMN3c_c",
  authDomain: "acessoriospro-52900.firebaseapp.com",
  databaseURL: "https://acessoriospro-52900-default-rtdb.firebaseio.com",
  projectId: "acessoriospro-52900",
  storageBucket: "acessoriospro-52900.firebasestorage.app",
  messagingSenderId: "903256013830",
  appId: "1:903256013830:web:a2b433530cac00690dd787"
};

const app = initializeApp(firebaseConfig);
export const dbFB = getDatabase(app);
export const auth = getAuth(app);

// App secundário para uso em rotinas de admin (criar usuário, trocar senha) sem deslogar o usuário principal
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
