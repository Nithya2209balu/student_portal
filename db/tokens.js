const mongoose = require("mongoose");

// We'll use a separate collection for "Broadcast Tokens" to match the user's snippet logic
const pushTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const PushToken = mongoose.model("PushToken", pushTokenSchema);

/**
 * Save a new token to the database
 */
const saveToken = async (token) => {
    try {
        await PushToken.findOneAndUpdate(
            { token },
            { token },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error("Error saving token:", err.message);
    }
};

/**
 * Retrieve all unique tokens
 */
const getTokens = async () => {
    try {
        const docs = await PushToken.find().select("token");
        return docs.map(d => d.token);
    } catch (err) {
        console.error("Error fetching tokens:", err.message);
        return [];
    }
};

module.exports = { saveToken, getTokens };
