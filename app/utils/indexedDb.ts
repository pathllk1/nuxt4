export class IndexedDbService {
  private dbName = 'EnterpriseToolsDB';
  private dbVersion = 4;
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  private initDb(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB is only available in browser environments'));
    }
    if (this.db) return Promise.resolve(this.db);
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('text_studio_documents')) {
          db.createObjectStore('text_studio_documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('notepad_notes')) {
          db.createObjectStore('notepad_notes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ai_api_keys')) {
          db.createObjectStore('ai_api_keys', { keyPath: 'provider' });
        }
        if (!db.objectStoreNames.contains('ai_conversations')) {
          db.createObjectStore('ai_conversations', { keyPath: 'id' });
        }
        if (db.objectStoreNames.contains('ai_messages')) {
          db.deleteObjectStore('ai_messages');
        }
        const msgStore = db.createObjectStore('ai_messages', { keyPath: 'id' });
        msgStore.createIndex('conversation_id', 'conversation_id', { unique: false });
        
        if (!db.objectStoreNames.contains('ai_settings')) {
          db.createObjectStore('ai_settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        this.openPromise = null;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        this.openPromise = null;
        reject(event.target.error || new Error('Failed to open database'));
      };
    });

    return this.openPromise;
  }

  async get<T>(storeName: string, id: any): Promise<T | null> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getMessagesByConversation(conversationId: string): Promise<any[]> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('ai_messages', 'readonly');
      const store = transaction.objectStore('ai_messages');
      const index = store.index('conversation_id');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteMessagesByConversation(conversationId: string): Promise<void> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('ai_messages', 'readwrite');
      const store = transaction.objectStore('ai_messages');
      const index = store.index('conversation_id');
      const request = index.openCursor(IDBKeyRange.only(conversationId));

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export const indexedDb = new IndexedDbService();
