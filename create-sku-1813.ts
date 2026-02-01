import { MongoClient } from 'mongodb';

async function createSku1813() {
  const uri = "mongodb+srv://avtofix2025_db_user:FTnjYsHxkYxgu7qH@cluster0.b2fwuli.mongodb.net/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ MongoDB ga ulandi');
    
    const db = client.db('avtofix');
    const collection = db.collection('products');
    
    // User ID (910712828 telefon raqami)
    const userId = '6974