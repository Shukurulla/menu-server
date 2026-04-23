const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true }, // числом в валюте ресторана (напр. 45000)
    image: { type: String, default: null },
    status: { type: String, enum: ['active', 'out', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Food', FoodSchema);
