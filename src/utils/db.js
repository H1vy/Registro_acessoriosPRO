const DB_NAME = 'AccessoriesProDB';
const DB_VERSION = 1;
const STORES = {
  accessories: 'accessories',
  responsibles: 'responsibles',
  movements: 'movements'
};

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' || 'timestamp' });
          // Nota: movements usa timestamp ou id próprio. Para simplificar, usaremos id em todos.
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
