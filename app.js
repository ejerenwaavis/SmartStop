require("dotenv").config();
const APIKEY = process.env.APIKEY;

const express = require("express");
const app = express();
const ejs = require("ejs");
const https = require("https");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");


app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));


const uri = "mongodb+srv://Admin-Avis:Password123@db1.s2pl8.mongodb.net/auto-g-codes-0";
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String
});

const gCodeSchema = new mongoose.Schema({
  geocode: String,
  name: String,
  streets: [String]
});

const User = mongoose.model("User", userSchema);
const GCode = mongoose.model("Gcode", gCodeSchema);



app.route("/")
  .get(function(req, res) {
    res.render("home", {
      body: new Body("G-Code", "", "")
    })
  })

app.route("/locate")
  .post(function(req, res) {
    const position = req.body.position;
    console.log(position);
    const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
    https.get(url, function(response) {
      console.log(response);
      response.on("data", function(data) {
        const location = JSON.parse(data);
        // res.send(location.items[0].address);
        res.render("code", {body:new Body("G-Code","",""), location:location.items[0].address})
      });
    });
  })



app.listen(3000, function() {
  console.log("GCodes is Live");
})

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
}
