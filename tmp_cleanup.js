const mongoose = require('mongoose');
require('dotenv').config();
const Document = require('./models/Document');

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const docs = await Document.find();
        let count = 0;
        
        for (let doc of docs) {
            if (doc.courseName && (doc.courseName.startsWith('"') || doc.courseName.endsWith('"'))) {
                const oldName = doc.courseName;
                doc.courseName = doc.courseName.replace(/^"(.*)"$/, '$1').trim();
                await doc.save();
                console.log(`Fixed: [${oldName}] -> [${doc.courseName}]`);
                count++;
            }
        }
        
        console.log(`✅ Cleaned up ${count} documents.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Error:', err);
        process.exit(1);
    }
};

cleanup();
