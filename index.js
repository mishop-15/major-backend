const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Help } = require("./models/Help");
const { User } = require("./models/User");
const userRouter = require("./routes/user");
const helpRouter = require("./routes/help");
const { reject_help, accept_help } = require("./controllers/help");

const app = express();
dotenv.config();

const connect = async () => {
    try {
        mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB database");
    } catch (err) {
        throw err;
    }
};

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use("/api/user", userRouter);
app.use("/api/help", helpRouter);

app.use((err, req, res, next) => {
    const errStatus = err.status || 500;
    const errMessage = err.message || "something went worng!";
    return res.status(errStatus).json({
        sucess: false,
        status: errStatus,
        message: errMessage,
        stack: err.stack,
    });
});

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
    connect();
    console.log(`server running on port : ${port}`);
});

//socket logics

const io = require("socket.io")(server, {
    cors: {
        origin: "*",
    },
});

let user_locations = {};
const socket_id_to_mongo_id = {};
const mongo_id_to_socket_id = {};

io.on("connection", (socket) => {
    console.log(`connect: ${socket.id}`);

    socket.on("disconnect", () => {
        delete user_locations[socket.id];
        delete mongo_id_to_socket_id[socket_id_to_mongo_id[socket.id]];
        delete socket_id_to_mongo_id[socket.id];
        console.log(`disconnect: ${socket.id}`);
        console.log("socket to mongo ", socket_id_to_mongo_id, "\n\n");
        console.log(" mongo to socket ", mongo_id_to_socket_id, "\n\n");
    });

    // socket.on("force_disconnect", (socketID) => {
    //     delete user_locations[socket.id];
    //     delete socket_id_to_mongo_id[socket.id];
    //     socket.disconnect();
    // });

    socket.on("register", (mongo_id) => {
        socket_id_to_mongo_id[socket.id] = mongo_id;
        mongo_id_to_socket_id[mongo_id] = socket.id;
        console.log("socket to mongo ", socket_id_to_mongo_id, "\n\n");
        console.log(" mongo to socket ", mongo_id_to_socket_id, "\n\n");
    });

    socket.on("update_location", (location_info) => {
        user_locations[socket.id] = location_info;
        console.log(user_locations);
    });

    socket.on("get_user_location", (user_mongo_id) => {
        io.to(socket.id).emit(
            "location_response",
            user_locations[mongo_id_to_socket_id[user_mongo_id]]
        );
    });

    socket.on("request_nearby_users", async (help_info) => {
        console.log(
            "------------------request_nearby_users----------------\n\n"
        );
        console.log("socket to mongo ", socket_id_to_mongo_id, "\n\n");
        console.log(" mongo to socket ", mongo_id_to_socket_id, "\n\n");
        const users = [];
        Object.keys(user_locations).forEach((user_id) => {
            let dist = 0;
            if (user_locations[user_id].latitude * help_info.latitude > 0) {
                dist += Math.pow(
                    Math.abs(
                        user_locations[user_id].latitude - help_info.latitude
                    ),
                    2
                );
            } else {
                dist +=
                    Math.pow(user_locations[user_id].latitude, 2) +
                    Math.pow(help_info.latitude, 2);
            }

            if (user_locations[user_id].longitude * help_info.longitude > 0) {
                dist += Math.pow(
                    Math.abs(
                        user_locations[user_id].longitude - help_info.longitude
                    ),
                    2
                );
            } else {
                dist +=
                    Math.pow(user_locations[user_id].longitude, 2) +
                    Math.pow(help_info.longitude, 2);
            }

            users.push({ user_id, dist });
        });

        users.sort((a, b) => {
            if (a.dist == b.dist) {
                return 0;
            }

            if (a.dist < b.dist) {
                return -1;
            }

            return 1;
        });

        console.log(users, "\n\n");
        const candidates_users = [];

        if (users.length === 1) {
            io.to(socket.id).emit("help_request_response", {
                success: false,
                message: "no users nearby",
            });
        } else {
            console.log(
                "help data :",
                {
                    user: socket_id_to_mongo_id[socket.id].toString(),
                    ...help_info,
                },
                "\n\n"
            );

            let help = Help({
                user: socket_id_to_mongo_id[socket.id].toString(),
                ...help_info,
            });

            const populated_help = await help
                .save()
                .then((saved_help) => saved_help.populate("user"));

            console.log("help sent to client : ", { ...populated_help });

            for (let i = 1; i < Math.min(6, users.length); i++) {
                io.to(users[i].user_id).emit("help_request", {
                    ...populated_help._doc,
                });

                candidates_users.push(
                    socket_id_to_mongo_id[users[i].user_id].toString()
                );
            }

            help.candidates = candidates_users;
            console.log("new help : ", help, "\n\n");
            await help.save();

            io.to(socket.id).emit("help_request_response", {
                success: true,
                message: "request sent to nearby users",
                help_id: help._id,
            });
        }
    });

    socket.on("help_accepted", async (help_id) => {
        console.log("------------------help accepted----------------\n\n");
        console.log(
            "accepting help ",
            help_id,
            " by ",
            socket_id_to_mongo_id[socket.id],
            "\n\n"
        );

        const res = await accept_help(
            help_id,
            socket_id_to_mongo_id[socket.id]
        );

        console.log("result : ", res, "\n\n");

        io.to(socket.id).emit("help_accept_response", {
            status: res.status,
            message: res.message,
        });

        if (res.status === "failed") {
            return;
        }

        io.to(mongo_id_to_socket_id[res.user_id]).emit("help_accepted");

        // const helper = await User.findById(socket_id_to_mongo_id(socket.id));
        // console.log("helper : ", helper);
        // io.to(help_info.sender).emit("help_accepted", {
        //     helper: helper,
        //     latitude: user_locations[socket.id].latitude,
        //     longitude: user_locations[socket.id].longitude,
        // });

        // socioket.to(socket.id).emit("help_accepted_succesfully", {
        //     help: help,
        // });

        // help.helper = socket_id_to_mongo_id(socket.id);
        // await help.save();
    });

    socket.on("help_reject", async (help_id) => {
        console.log("------------------help reject----------------\n\n");
        console.log("socket to mongo ", socket_id_to_mongo_id, "\n\n");
        console.log(" mongo to socket ", mongo_id_to_socket_id, "\n\n");

        console.log(
            "rejecting ",
            help_id,
            " from ",
            socket_id_to_mongo_id[socket.id],
            " with socket id ",
            socket.id,
            "\n\n"
        );

        const res = await reject_help(
            help_id,
            socket_id_to_mongo_id[socket.id]
        );

        console.log("result : ", res, "\n\n");
        console.log(
            "user socket id of help ",
            mongo_id_to_socket_id[res.user_id],
            "\n\n"
        );

        if (res.help_request_failed) {
            socket
                .to(mongo_id_to_socket_id[res.user_id])
                .emit("help_request_failed", {
                    message: "no users accepted your help request",
                });
        }

        io.to(socket.id).emit("help_reject_response", {
            status: res.status,
            message: res.message,
        });
    });
});

module.exports = { user_locations, mongo_id_to_socket_id };
