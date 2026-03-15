const DB_NAME = 'AccessoriesProDB';
const DB_VERSION = 2; // Incrementado para adicionar a store de usuários
const STORES = {
  accessories: 'accessories',
  responsibles: 'responsibles',
  movements: 'movements',
  users: 'users' // Nova store para autenticação
};

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.keys(STORES).forEach(storeKey => {
        const storeName = STORES[storeKey];
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
  });
};

export const getAllData = async (storeName) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const addRecord = async (storeName, record) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(record);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteRecord = async (storeName, id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const seedAdminUser = async () => {
  const users = await getAllData('users');
  if (users.length === 0) {
    const adminUser = {
      id: 'admin-id',
      username: 'admin',
      password: 'admin123', // Senha padrão solicitada
      role: 'admin'
    };
    await addRecord('users', adminUser);
    console.log('Usuário admin semeado com sucesso.');
  }
};

export const saveData = async (storeName, data) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        if (data && data.length > 0) {
          data.forEach(item => {
            store.add(item);
          });
        }
      };

      transaction.oncomplete = () => {
        console.log(`Dados salvos com sucesso em ${storeName}`);
        resolve();
      };
      
      transaction.onerror = (event) => {
        console.error(`Erro na transação de salvamento (${storeName}):`, event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error(`Falha ao iniciar transação para ${storeName}:`, error);
    throw error;
  }
};
