const { User } = require("../models/User.js");

const get_user = async (req, res, next) => {
    try {
        const user = await User.findById(req.query.user_id);
        res.status(200).json(user);
    } catch (err) {
        next(err);
    }
};

module.exports = { get_user };
