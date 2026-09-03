const DB_NAME = "metaxu";
const STORE_NAME = "journey-saves";

export interface JourneySaveRecord<T> {
  version: 2;
  savedAt: string;
  payload: T;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class JourneySaveStore<T> {
  async write(slot: string, payload: T): Promise<void> {
    const database = await openDatabase();
    const record: JourneySaveRecord<T> = {
      version: 2,
      savedAt: new Date().toISOString(),
      payload: structuredClone(payload),
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record, slot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  async read(slot: string): Promise<JourneySaveRecord<T> | null> {
    const database = await openDatabase();
    const record = await new Promise<JourneySaveRecord<T> | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(slot);
      request.onsuccess = () => resolve((request.result as JourneySaveRecord<T> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!record || record.version !== 2) return null;
    return structuredClone(record);
  }
}
