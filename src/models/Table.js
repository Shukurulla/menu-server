const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    kind: { type: String, enum: ['table', 'room'], default: 'table' }, // Стол | Зал
    name: { type: String, required: true },
    number: { type: String, required: true },
    slug: { type: String, required: true }, // T-01, X-101 и т.д.
  },
  { timestamps: true }
);

TableSchema.index({ restaurant: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Table', TableSchema);
