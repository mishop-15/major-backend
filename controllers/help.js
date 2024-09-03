const { WAITING, ACCEPTED, COMPLETED } = require("../constants.js");
const { user_locations, mongo_id_to_socket_id } = require("../index.js");
const { Help } = require("../models/Help.js");
const { create_error } = require("../utils/error.js");

const get_related_help_requests = async (req, res, next) => {
    try {
        const helps = await Help.find({
            candidates: { $in: [req.query.user_id] },
            status: { $eq: WAITING },
        }).populate("user");

        res.status(200).json(helps);
    } catch (err) {
        console.log(err);
        next(err);
    }
};

const get_accepted_help = async (req, res, next) => {
    try {
        const help = await Help.findById(req.query.help_id)
            .populate("user")
            .populate("helper");

        res.status(200).json(help);
    } catch (err) {
        console.log(err);
        next(err);
    }
};
const reject_help = async (help_id, given_user_id) => {
    try {
        const help = await Help.findById(help_id);

        if (!help) {
            return {
                status: "failed",
                message: "invalid help_id",
            };
        }

        help.candidates = help.candidates.filter((user_id) => {
            console.log(user_id.toString(), given_user_id);
            return user_id.toString() !== given_user_id;
        });

        await help.save();

        const res = {
            status: "successful",
            message: "rejected help request",
        };

        if (!help.candidates.length) {
            res.help_request_failed = true;
            res.user_id = help.user.toString();
            await Help.findByIdAndDelete(help_id);
        }

        return res;
    } catch (err) {
        console.log(err);
        return {
            status: "failed",
            message: err,
        };
    }
};

const accept_help = async (help_id, user_id) => {
    try {
        const help = await Help.findById(help_id);

        if (!help) {
            return {
                status: "failed",
                message: "invalid help_id",
            };
        }

        if (help.status != WAITING) {
            return {
                status: "failed",
                message: "help has already been accepted",
            };
        }

        help.helper = user_id;
        help.status = ACCEPTED;

        await help.save();

        return {
            status: "successful",
            message: "help request accepted",
            user_id: help.user,
        };
    } catch (err) {
        console.log(err);
        return {
            status: "failed",
            message: err,
        };
    }
};

const complete_help = async (help_id) => {
    try {
        const help = await Help.findById(help_id);

        if (!help) {
            return {
                status: "failed",
                message: "invalid help_id",
            };
        }

        if (help.status === WAITING) {
            return {
                status: "failed",
                message:
                    "help request is not accepted hence cant be marked complete",
            };
        }

        if (help.status === COMPLETED) {
            return {
                status: "failed",
                message: "help request has already been completed",
            };
        }

        help.status = COMPLETED;

        await help.save();

        return {
            status: "successful",
            message: "help request completed",
        };
    } catch (err) {
        console.log(err);
        return {
            status: "failed",
            message: err,
        };
    }
};

module.exports = {
    get_related_help_requests,
    get_accepted_help,
    reject_help,
    accept_help,
    complete_help,
};
