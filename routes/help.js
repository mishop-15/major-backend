const { Router } = require("express");
const {
    get_related_help_requests,
    reject_help,
    get_accepted_help,
} = require("../controllers/help.js");

const router = Router();

router.get("/all", get_related_help_requests);
router.get("/", get_accepted_help);
router.delete("/", reject_help);

module.exports = router;
