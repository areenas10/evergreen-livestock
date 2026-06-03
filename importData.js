const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function importData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/evergreen_livestock');
        console.log('MongoDB Connected.');

        const backupPath = '../database_backup.json';
        if (!fs.existsSync(backupPath)) {
            console.error('Backup file not found! Make sure database_backup.json is in the everM folder.');
            process.exit(1);
        }

        const rawData = fs.readFileSync(backupPath);
        const data = JSON.parse(rawData);

        const db = mongoose.connection.db;

        for (const [collectionName, documents] of Object.entries(data)) {
            if (documents.length > 0) {
                // Drop existing collection if it exists to avoid duplicate key errors
                const collections = await db.listCollections({ name: collectionName }).toArray();
                if (collections.length > 0) {
                    await db.collection(collectionName).drop();
                    console.log(`Dropped existing collection: ${collectionName}`);
                }

                // Insert documents
                await db.collection(collectionName).insertMany(documents);
                console.log(`Imported ${documents.length} documents into ${collectionName}`);
            }
        }

        console.log('Database import completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error importing data:', err);
        process.exit(1);
    }
}

importData();
