const mongoose = require("mongoose");

const user_schema = new mongoose.Schema({
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    phone_no: { type: String, required: true, unique: true },
});

const User = mongoose.model("User", user_schema);

module.exports = { User };
