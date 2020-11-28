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

const communitySchema = new mongoose.Schema({
  communityName: String,
  streets: [{}], //array of location objects
  gateCodes:[{  // array of gateCode Objects
    description:String,
    value:Number
  }]
});

const User = mongoose.model("User", userSchema);
const Community = mongoose.model("Community", communitySchema);



app.route("/")
  .get(function(req, res) {
    res.render("home", {
      body: new Body("G-Code", "", "")
    })
  })

app.route("/locate")
  .get(function(req,res){
    res.redirect("/");
  })
  .post(function(req, res) {
    const position = req.body.position;
    // console.log(position);
    const url = 'https://revgeocode.search.hereapi.com/v1/revgeocode?apiKey=' + APIKEY + '&at=' + position + '&lang=en-US'
    https.get(url, function(response) {
      response.on("data", function(data) {
        const location = JSON.parse(data);
        // res.send(location.items[0].address);
        res.render("code", {body:new Body("G-Code","",""), location:location.items[0].address})
      });
    });
  })

app.route("/adminAdd")
  .get(function(req,res){
    res.render("adminAdd", {body:new Body("G-code|Admin","","")})
  })
  .post(function(req,res){
    const community = new Community({
      communityName: req.body.communityName,
      streets: req.body.streets.split("_"), //array of location objects
      gateCodes:req.body.gateCodes.split("_"), // array of gateCode Objects
    });
    res.send(community);
  })



app.listen(process.env.PORT||3000, function() {
  console.log("GCodes is Live");
})

function Body(title, error, message) {
  this.title = title;
  this.error = error;
  this.message = message;
}
