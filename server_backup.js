const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// load environment variables
dotenv.config({ path: './.env.production' });

const PORT = 3000;

// Middleware
app.use(cors());

// Routes

// app.get("/dummy-data/groceries", (req, res) => {
//   const groceries = require("./dummy-data/groceries.json");
//   res.json(groceries);
// });

// app.get("/api/groceries", (req, res) => {
//   const groceries = require("./db/groceries.json");
//   res.json(groceries);
// });

// app.get("/api/employees", (req, res) => {
//   const employees = require("./db/employees.json");
//   res.json(employees);
// });

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

const connections = {};
const models = {};

const grocerySchema = new mongoose.Schema({
    item: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true
    },
    food_group: {
        type: String,
        required: [true, 'Food group is required'],
        enum: ['fruits', 'vegetables', 'proteins', 'dairy', 'grains', 'nuts']
    },
    price_in_usd: {
        type: Number,
        required: [true, 'Price is required']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: 0
    },
    calories_per_100g: Number,
    organic: Boolean,
    wild_caught: Boolean,
    fat_content: String,
    gluten_free: Boolean,
    free_range: Boolean
});

const getConnection = async (dbName) => {
    console.log('getConnection called with dbName:', dbName);

    if (!connections[dbName]) {
        const DB = process.env.MONGO_URI.replace('<PASSWORD>', process.env.MONGO_PASS).replace('/?', `/${dbName}?`);
        console.log('Creating new connection. Connection string (hidden password):',
            DB.replace(process.env.MONGO_PASS, '****'));

        connections[dbName] = await mongoose.createConnection(DB);
        console.log('New connection created for database:', dbName);
    } else {
        console.log('Reusing existing connection for database:', dbName);
    }

    return connections[dbName];
}

const getModel = async (dbName, collectionName) => {
    console.log('getModel called with:', { dbName, collectionName });

    const modelKey = `${dbName}-${collectionName}`;
    console.log('Generated modelKey:', modelKey);

    if (!models[modelKey]) {
        console.log('Model not found in cache, creating new model');
        const connection = await getConnection(dbName);
        models[modelKey] = connection.model(collectionName, grocerySchema, collectionName);  // Added third parameter
        console.log('Created new model for collection:', collectionName);
    } else {
        console.log('Reusing cached model for:', modelKey);
    }

    return models[modelKey];
}

// Modified GET route with debugging
app.get("/find/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        console.log('GET request received for:', { database, collection });

        const Model = await getModel(database, collection);
        console.log('Model retrieved, executing find query');

        const documents = await Model.find({}).lean();
        console.log('Query executed, document count:', documents.length);

        res.status(200).json(documents);
    } catch (err) {
        console.error('Error in GET route:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create (Insert) endpoint
app.post("/insert/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const Model = await getModel(database, collection);
        // check if single or multiple documents
        if (req.body.document) {
            // single document insert
            const newDocument = await Model.create(req.body.document);
            res.status(201).json({
                message: 'Document inserted successfully',
                insertedId: newDocument._id
            });
        }
        else if (req.body.documents && Array.isArray(req.body.documents)) {
            // multiple documents insert
            const newDocuments = await Model.insertMany(req.body.documents);
            res.status(201).json({
                message: `${newDocuments.length} documents inserted`,
                insertedIds: newDocuments.map(doc => doc._id)
            })
        }
        else {
            res.status(400).json({
                error: "Request body must contain either 'document' or 'documents' as array"
            })
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete endpoint
app.delete("/delete/:database/:collection/:id", async (req, res) => {
    try {
        const { database, collection, id } = req.params;

        const Model = await getModel(database, collection);
        const result = await Model.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).send(`Document with ID ${id} not found.`)
        }
        res.status(200).send(`Document with ID ${id} deleted successfully.`);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update endpoint
app.put("/update/:database/:collection/:id", async (req, res) => {
    try {

        const { database, collection, id } = req.params;
        const Model = await getModel(database, collection);
        const result = await Model.findByIdAndUpdate(
            req.params.id,
            { $set: req.body.update },
            { new: true, runValidators: true }
        );
        if (!result) {
            return res.status(404).json({ message: 'Document not found' });
        }
        res.status(200).json({
            message: 'Document updated successfully',
            modifiedDocument: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// **Start the server after defining routes**
async function startServer() {
    try {
        console.log('Starting server with environment variables:', {
            MONGO_URI: process.env.MONGO_URI ? 'Present' : 'Missing',
            MONGO_PASS: process.env.MONGO_PASS ? 'Present' : 'Missing',
            PORT: process.env.PORT || 3000
        });

        // Test database connection before starting server
        const testConnection = await getConnection('BigBoxStore');
        console.log('Successfully connected to MongoDB');

        // Test collection access
        const testModel = await getModel('BigBoxStore', 'GroceryInventory');
        const count = await testModel.countDocuments();
        console.log(`Found ${count} documents in GroceryInventory collection`);

        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error("Error starting server:", err);
        process.exit(1);
    }
}

startServer();