const express = require("express");
const Model = require("../models/model");
const { controller } = require("./controller");
const router = express.Router();
// const transporter = require("./mailer");

router.use((req, res, next) => {
  res.header("X-Frame-Options", "DENY");
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

//add and withdraw
router.post("/add", controller.add);
router.get("/withdraw", controller.withdraw);
router.post("/speedup", controller.speedup);

// Get all Method
router.get("/getAll", async (req, res) => {
  try {
    const data = await Model.find();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Get by id Method
router.get("/getOne/:id", async (req, res) => {
  try {
    const data = await Model.findOne({
      id: req.params.id,
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Update by id Method
router.patch("/update/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const options = { new: true };

    const result = await Model.findOneAndUpdate(
      {
        id: id,
      },
      {used: true},
      options
    );

    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
