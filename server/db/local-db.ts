import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Electron app data directory
const getDataDir = () => {
  if (typeof app !== 'undefined') {
    return path.join(app.getPath('userData'), 'data');
  }
  return path.join(process.cwd(), 'data');
};

const DATA_DIR = getDataDir();
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface Database {
  users: any[];
  products: any[];
  categories: any[];
  sales: any[];
  debts: any[];
  stores: any[];
  [key: string]: any[];
}

// Initialize database
const initializeDB = (): Database => {
  if (!fs.existsSync(DB_FILE)) {
    const initialDB: Database = {
      users: [],
      products: [],
      categories: [],
      sales: [],
      debts: [],
      stores: [],
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

// Read database
export const readDB = (): Database => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return initializeDB();
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (error) {
    console.error('Error reading database:', error);
    return initializeDB();
  }
};

// Write database
export const writeDB = (data: Database) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing database:', error);
  }
};

// Get collection
export const getCollection = (collectionName: string): any[] => {
  const db = readDB();
  if (!db[collectionName]) {
    db[collectionName] = [];
    writeDB(db);
  }
  return db[collectionName];
};

// Add document
export const addDocument = (collectionName: string, doc: any) => {
  const db = readDB();
  if (!db[collectionName]) {
    db[collectionName] = [];
  }
  const newDoc = {
    ...doc,
    _id: doc._id || doc.id || Date.now().toString(),
    createdAt: doc.createdAt || new Date(),
  };
  db[collectionName].push(newDoc);
  writeDB(db);
  return newDoc;
};

// Update document
export const updateDocument = (collectionName: string, id: string, updates: any) => {
  const db = readDB();
  if (!db[collectionName]) return null;
  
  const index = db[collectionName].findIndex(doc => doc._id === id || doc.id === id);
  if (index === -1) return null;
  
  db[collectionName][index] = {
    ...db[collectionName][index],
    ...updates,
    updatedAt: new Date(),
  };
  writeDB(db);
  return db[collectionName][index];
};

// Delete document
export const deleteDocument = (collectionName: string, id: string) => {
  const db = readDB();
  if (!db[collectionName]) return false;
  
  const index = db[collectionName].findIndex(doc => doc._id === id || doc.id === id);
  if (index === -1) return false;
  
  db[collectionName].splice(index, 1);
  writeDB(db);
  return true;
};

// Find documents
export const findDocuments = (collectionName: string, query: any = {}) => {
  const collection = getCollection(collectionName);
  if (Object.keys(query).length === 0) return collection;
  
  return collection.filter(doc => {
    return Object.entries(query).every(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        // Handle complex queries
        return JSON.stringify(doc[key]) === JSON.stringify(value);
      }
      return doc[key] === value;
    });
  });
};

// Find one document
export const findOneDocument = (collectionName: string, query: any) => {
  const results = findDocuments(collectionName, query);
  return results.length > 0 ? results[0] : null;
};

// Initialize database on startup
initializeDB();
