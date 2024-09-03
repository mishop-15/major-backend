const { Router } = require("express");
const { get_user } = require("../controllers/user.js");

const router = Router();

router.get("/", get_user);

module.exports = router;
