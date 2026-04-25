const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
    name: String,
    price: Number,
    qty: Number,
    image: { type: String, default: null },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    tableName: String,
    items: [OrderItemSchema],
    comment: { type: String, default: '' },
    total: { type: Number, required: true },
    currencySymbol: { type: String, default: 'сум' },
    clientId: { type: String, default: null, index: true },
    status: { type: String, enum: ['new', 'seen'], default: 'new', index: true },
    seenAt: { type: Date, default: null },
    number: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);
