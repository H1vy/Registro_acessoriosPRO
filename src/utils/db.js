import { ref, get, set, child, remove, push, onValue } from "firebase/database";
import { dbFB, secondaryAuth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

export const getAllData = async (storeName) => {
  try {
    const dbRef = ref(dbFB);
    const snapshot = await get(child(dbRef, storeName));
    if (snapshot.exists()) {
      // O Firebase retorna um objeto quando são adds sucessivos. Precisamos converte para Array.
      const data = snapshot.val();
      if (Array.isArray(data)) {
        return data.filter(item => item !== null);
      }
      return Object.values(data);
    } else {
      return [];
    }
  } catch (error) {
    console.error(`Erro ao buscar ${storeName}:`, error);
    return [];
  }
};

export const subscribeToData = (storeName, callback) => {
  const dbRef = ref(dbFB, storeName);
  return onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (Array.isArray(data)) {
        callback(data.filter(item => item !== null));
      } else {
        callback(Object.values(data));
      }
    } else {
      callback([]);
    }
  });
};

export const addRecord = async (storeName, record) => {
  try {
    const defaultData = await getAllData(storeName);
    const newData = [...defaultData, record];
    await set(ref(dbFB, storeName), newData);
    return newData;
  } catch (error) {
    console.error(`Erro ao adicionar em ${storeName}:`, error);
    throw error;
  }
};

export const deleteRecord = async (storeName, id) => {
  try {
    const defaultData = await getAllData(storeName);
    const newData = defaultData.filter(item => item.id !== id);
    await set(ref(dbFB, storeName), newData);
    return newData;
  } catch (error) {
    console.error(`Erro ao apagar ${id} de ${storeName}:`, error);
    throw error;
  }
};

export const saveData = async (storeName, data) => {
  try {
    await set(ref(dbFB, storeName), data);
    console.log(`Dados salvos inteiramente com sucesso em ${storeName} no Firebase.`);
  } catch (error) {
    console.error(`Erro ao salvar array em ${storeName}:`, error);
    throw error;
  }
};

export const seedAdminUser = async () => {
  try {
    let authUid = null;

    // 1. Garantir que o Firebase Auth tenha o admin criado e pegar o UID dele
    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, 'admin@acessoriospro.com', 'Admin123');
      authUid = userCred.user.uid;
      console.log('Firebase Auth: Usuário admin criado com sucesso.');
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        // Se já existe, logar para pegar o UID correto
        const userCred = await signInWithEmailAndPassword(secondaryAuth, 'admin@acessoriospro.com', 'Admin123');
        authUid = userCred.user.uid;
      } else {
        console.error('Erro de autenticação ao processar admin:', authErr);
        return;
      }
    }

    // 2. Garantir que o banco de dados rastreie ESSE exato UID
    let users = await getAllData('users');
    const dbAdmin = users.find(u => u.id === authUid);

    if (!dbAdmin) {
      // Remover admins antigos locais (admin-id) se houver para evitar duplicidade
      const legacyAdminIndex = users.findIndex(u => u.id === 'admin-id' || (u.role === 'admin' && !u.email));
      if (legacyAdminIndex > -1) {
        users.splice(legacyAdminIndex, 1);
      }
      
      const adminUser = {
        id: authUid,
        username: 'Admin',
        email: 'admin@acessoriospro.com',
        password: 'Admin123',
        role: 'admin'
      };
      
      const newUsers = [...users, adminUser];
      await set(ref(dbFB, 'users'), newUsers);
      console.log('Realtime DB: Sincronização do admin concluída.');
    } else {
      console.log('Banco de dados e Auth do admin estão sincronizados.');
    }

    // Limpar sessão secundária
    await signOut(secondaryAuth);

  } catch (error) {
    console.error('Erro ao semear o Admin no Firebase:', error);
  }
};
