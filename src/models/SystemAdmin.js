const mongoose = require('mongoose');

const SystemAdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // AES-encrypted
    name: { type: String, default: 'Super Admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemAdmin', SystemAdminSchema);
