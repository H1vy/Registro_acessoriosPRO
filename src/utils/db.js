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
      const resolved = Array.isArray(data) ? data.filter(item => item !== null) : Object.values(data);
      // Espelhar no localStorage para carregamento ultra-rápido no próximo F5
      localStorage.setItem(storeName, JSON.stringify(resolved));
      callback(resolved);
    } else {
      callback([]);
    }
  });
};

export const updateRecord = async (storeName, id, updates) => {
  try {
    // Busca os dados atuais para encontrar o índice do item
    const dbRef = ref(dbFB, storeName);
    const snapshot = await get(dbRef);
    let data = snapshot.val() || [];
    
    // Se for um array, encontramos o índice. Se for objeto, acessamos direto.
    if (Array.isArray(data)) {
      const index = data.findIndex(item => item && item.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        await set(ref(dbFB, storeName), data);
      }
    } else {
      // Se o Firebase transformou em objeto (chaves numéricas ou IDs)
      const key = Object.keys(data).find(k => data[k].id === id);
      if (key) {
        await set(ref(dbFB, `${storeName}/${key}`), { ...data[key], ...updates });
      }
    }
    console.log(`Registro ${id} atualizado em ${storeName}.`);
  } catch (error) {
    console.error(`Erro ao atualizar ${id} em ${storeName}:`, error);
    throw error;
  }
};

export const saveData = async (storeName, data) => {
  try {
    // Filtra nulos que o Firebase pode inserir ao deletar índices de array
    const cleanData = Array.isArray(data) ? data.filter(i => i !== null) : data;
    await set(ref(dbFB, storeName), cleanData);
    localStorage.setItem(storeName, JSON.stringify(cleanData));
    console.log(`Dados sincronizados em Firebase e LocalStorage para ${storeName}.`);
  } catch (error) {
    console.error(`Erro ao salvar array em ${storeName}:`, error);
    throw error;
  }
};

export const addRecord = async (storeName, record) => {
  try {
    const data = await getAllData(storeName);
    const newData = [...data, record];
    await saveData(storeName, newData);
  } catch (error) {
    console.error(`Erro ao adicionar record em ${storeName}:`, error);
    throw error;
  }
};

export const deleteRecord = async (storeName, id) => {
  try {
    const data = await getAllData(storeName);
    const newData = data.filter(item => item && item.id !== id);
    await saveData(storeName, newData);
  } catch (error) {
    console.error(`Erro ao deletar record ${id} em ${storeName}:`, error);
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
        role: 'admin',
        sector: 'estoque'
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

export const migrateUsersSector = async () => {
  try {
    const users = await getAllData('users');
    const needsMigration = users.some(u => !u.sector);
    
    if (needsMigration) {
      const migratedUsers = users.map(u => ({
        ...u,
        sector: u.sector || 'estoque'
      }));
      await set(ref(dbFB, 'users'), migratedUsers);
      console.log('Migration de sector concluída: usuários existentes definidos como estoque');
    } else {
      console.log('Nenhum usuário precisa de migration de sector');
    }
  } catch (error) {
    console.error('Erro ao executar migration de sector:', error);
  }
};

// Funções exclusivas para Ordens de Serviço (OS) com Base64
export const saveServiceOrderContent = async (id, base64) => {
  try {
    await set(ref(dbFB, `service_order_content/${id}`), base64);
  } catch (error) {
    console.error(`Erro ao salvar conteúdo da OS ${id}:`, error);
    throw error;
  }
};

export const getServiceOrderContent = async (id) => {
  try {
    const snapshot = await get(ref(dbFB, `service_order_content/${id}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error(`Erro ao obter conteúdo da OS ${id}:`, error);
    return null;
  }
};
