// ./models/Products.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Product price is required'],
        min: [0, 'Price cannot be negative']
    },
    // Add other fields as necessary
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = productSchema;
