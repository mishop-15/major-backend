const mongoose = require("mongoose");
const { WAITING, ACCEPTED, COMPLETED } = require("../constants");

const help_schema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    helper: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
    hospital_name: { type: String, required: true },
    issue: { type: String, required: true },
    urgency: { type: Number, required: true },
    tip: { type: Number },
    status: {
        type: String,
        enum: [WAITING, ACCEPTED, COMPLETED],
        default: WAITING,
    },
});

const Help = mongoose.model("Help", help_schema);

module.exports = { Help };
