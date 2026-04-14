import { ref, get, set, child, remove, push, onValue } from "firebase/database";
import { dbFB } from "./firebase";

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
    let users = await getAllData('users');
    const adminUserExists = users.find(u => u.role === 'admin' && u.username === 'Admin');

    if (!adminUserExists) {
      const adminUser = {
        id: 'admin-id',
        username: 'Admin',
        password: 'Admin123',
        role: 'admin'
      };
      
      const newUsers = [...users, adminUser];
      await set(ref(dbFB, 'users'), newUsers);
      console.log('Realtime DB: Usuário admin criado com sucesso.');
    } else {
      console.log('Banco de dados possui admin.');
    }
  } catch (error) {
    console.error('Erro ao semear o Admin no Firebase:', error);
  }
};
