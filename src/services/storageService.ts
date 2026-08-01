import type { AudioAsset } from '@/types';
import { generateId, inferAssetType } from '@/utils';

const DB_NAME = 'web-mpc-db';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const ASSETS_STORE = 'assets';
const BLOBS_STORE = 'blobs';

interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: string;
}

interface StoredAsset {
  id: string;
  meta: AudioAsset;
}

interface StoredBlob {
  id: string;
  blob: Blob;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async saveProject(projectJson: string, id: string, name: string, createdAt: number, updatedAt: number): Promise<void> {
    await this.init();
    const record: StoredProject = { id, name, createdAt, updatedAt, data: projectJson };
    await new Promise<void>((resolve, reject) => {
      const request = this.getStore(PROJECTS_STORE, 'readwrite').put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadProject(id: string): Promise<{ projectJson: string; name: string; createdAt: number; updatedAt: number } | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(PROJECTS_STORE).get(id);
      request.onsuccess = () => {
        const result = request.result as StoredProject | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        resolve({
          projectJson: result.data,
          name: result.name,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async listProjects(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(PROJECTS_STORE).getAll();
      request.onsuccess = () => {
        const results = (request.result as StoredProject[]).map((p) => ({
          id: p.id,
          name: p.name,
          updatedAt: p.updatedAt,
        }));
        resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      const request = this.getStore(PROJECTS_STORE, 'readwrite').delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveAsset(file: File): Promise<AudioAsset> {
    await this.init();
    const id = generateId();
    const meta: AudioAsset = {
      id,
      name: file.name.replace(/\.[^/.]+$/, ''),
      type: inferAssetType(file.name),
      fileName: file.name,
      mimeType: file.type || 'audio/mpeg',
      duration: 0,
      size: file.size,
      createdAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([ASSETS_STORE, BLOBS_STORE], 'readwrite');
      tx.objectStore(ASSETS_STORE).put({ id, meta });
      tx.objectStore(BLOBS_STORE).put({ id, blob: file });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return meta;
  }

  async updateAssetMeta(asset: AudioAsset): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      const request = this.getStore(ASSETS_STORE, 'readwrite').put({ id: asset.id, meta: asset });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAssetMeta(id: string): Promise<AudioAsset | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(ASSETS_STORE).get(id);
      request.onsuccess = () => {
        const result = request.result as StoredAsset | undefined;
        resolve(result?.meta ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAssets(): Promise<AudioAsset[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(ASSETS_STORE).getAll();
      request.onsuccess = () => {
        const results = (request.result as StoredAsset[]).map((a) => a.meta);
        resolve(results.sort((a, b) => b.createdAt - a.createdAt));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAssetBlob(id: string): Promise<Blob | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.getStore(BLOBS_STORE).get(id);
      request.onsuccess = () => {
        const result = request.result as StoredBlob | undefined;
        resolve(result?.blob ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAsset(id: string): Promise<void> {
    await this.init();
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction([ASSETS_STORE, BLOBS_STORE], 'readwrite');
      tx.objectStore(ASSETS_STORE).delete(id);
      tx.objectStore(BLOBS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new IndexedDBService();
