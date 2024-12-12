const express = require("express");
const cors = require("cors");
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env.production' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// Import Schemas
const productSchema = require('./models/Product');
// const userSchema = require('./models/User');
// const employeeSchema = require('./models/Employee');

// Mapping of database names to their respective URIs
const uriMap = {
    'ProductsDB': process.env.MONGO_CLIENT_URI,            // For Products collection
    'UsersEmployeesDB': process.env.MONGO_SERVER_URI,      // For Users and Employees collections
};

// Store connections and models
const connections = {};
const models = {};

// Function to get or create a connection based on the database name
const getConnection = async (dbName) => {
    console.log('getConnection called with dbName:', dbName);

    if (!uriMap[dbName]) {
        throw new Error(`No URI mapped for database: ${dbName}`);
    }

    if (!connections[dbName]) {
        const DB_URI = uriMap[dbName];
        console.log(`Creating new connection for ${dbName}.`);

        connections[dbName] = await mongoose.createConnection(DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`New connection established for database: ${dbName}`);
    } else {
        console.log(`Reusing existing connection for database: ${dbName}`);
    }

    return connections[dbName];
};

// Function to get or create a model based on the database and collection name
const getModel = async (dbName, collectionName) => {
    console.log('getModel called with:', { dbName, collectionName });

    const modelKey = `${dbName}-${collectionName}`;
    console.log('Generated modelKey:', modelKey);

    if (!models[modelKey]) {
        console.log('Model not found in cache, creating new model');
        const connection = await getConnection(dbName);

        // Assign the appropriate schema based on the collection name
        let schema;
        switch(collectionName) {
            case 'Products':
                schema = productSchema;
                break;
            case 'Users':
                schema = userSchema;
                break;
            case 'Employees':
                schema = employeeSchema;
                break;
            default:
                throw new Error(`No schema defined for collection: ${collectionName}`);
        }

        models[modelKey] = connection.model(collectionName, schema, collectionName);
        console.log(`Created new model for collection: ${collectionName}`);
    } else {
        console.log(`Reusing cached model for: ${modelKey}`);
    }

    return models[modelKey];
};

// Routes

// GET route to find documents
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

// POST route to insert documents
app.post("/insert/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const Model = await getModel(database, collection);

        // Check if single or multiple documents
        if (req.body.document) {
            // Single document insert
            const newDocument = await Model.create(req.body.document);
            res.status(201).json({
                message: 'Document inserted successfully',
                insertedId: newDocument._id
            });
        }
        else if (req.body.documents && Array.isArray(req.body.documents)) {
            // Multiple documents insert
            const newDocuments = await Model.insertMany(req.body.documents);
            res.status(201).json({
                message: `${newDocuments.length} documents inserted`,
                insertedIds: newDocuments.map(doc => doc._id)
            });
        }
        else {
            res.status(400).json({
                error: "Request body must contain either 'document' or 'documents' as array"
            });
        }
    } catch (err) {
        console.error('Error in POST route:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE route to remove a document by ID
app.delete("/delete/:database/:collection/:id", async (req, res) => {
    try {
        const { database, collection, id } = req.params;

        const Model = await getModel(database, collection);
        const result = await Model.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).send(`Document with ID ${id} not found.`);
        }
        res.status(200).send(`Document with ID ${id} deleted successfully.`);
    } catch (err) {
        console.error('Error in DELETE route:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT route to update a document by ID
app.put("/update/:database/:collection/:id", async (req, res) => {
    try {
        const { database, collection, id } = req.params;
        const updateData = req.body.update;

        if (!updateData) {
            return res.status(400).json({ error: "Update data not provided" });
        }

        const Model = await getModel(database, collection);
        const result = await Model.findByIdAndUpdate(
            id,
            { $set: updateData },
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
        console.error('Error in PUT route:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start the server after defining routes
async function startServer() {
    try {
        console.log('Starting server with environment variables:', {
            MONGO_CLIENT_URI: process.env.MONGO_CLIENT_URI ? 'Present' : 'Missing',
            MONGO_SERVER_URI: process.env.MONGO_SERVER_URI ? 'Present' : 'Missing',
            PORT: process.env.PORT || 3000
        });

        // Test connections before starting server
        const testDatabases = ['ProductsDB', 'UsersEmployeesDB'];
        for (const dbName of testDatabases) {
            const connection = await getConnection(dbName);
            console.log(`Successfully connected to MongoDB database: ${dbName}`);

            // Optionally, perform a simple query to ensure collections are accessible
            const testCollections = dbName === 'ProductsDB' ? ['Products'] : ['Users', 'Employees'];
            for (const collectionName of testCollections) {
                const Model = await getModel(dbName, collectionName);
                const count = await Model.estimatedDocumentCount();
                console.log(`Found approximately ${count} documents in ${collectionName} collection of ${dbName}`);
            }
        }

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Error starting server:", err);
        process.exit(1);
    }
}

startServer();
