require('babel-register');
var express = require('express');
const app = express();
var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

var db = require('./db')


var nconf = require('nconf');
var Twit = require('twit');
var _ = require('lodash');
var bayes = require('bayes');
var classifier = bayes();
var fs = require('fs-extra');
this.followersData = [];
var request = require('request');

const calculateHappiness = (dataArray) => {
  var totalPos = 0;
  var totalNeg = 0;
  for (var tweet of dataArray.n) {
    totalNeg += parseInt(tweet.followers);
  }
  for (var tweet of dataArray.p) {
    totalPos += parseInt(tweet.followers);
  }
  const happyAvg = totalPos / dataArray.p.length;
  const negAvg = totalNeg / dataArray.n.length;
  const betterAmount = happyAvg > negAvg ? "happy" : "not happy";
  const worstAmount = happyAvg < negAvg ? "happy" : "not happy";
  console.log("Got the following from trained data: \n");
  console.log("Average of followers of users who are happy: ", happyAvg);
  console.log("Average of followers of users who are not happy: ", negAvg);
  console.log("\n");
  console.log(`Users who are ${betterAmount} have ${Math.round((Math.abs(happyAvg - negAvg) / Math.max(happyAvg, negAvg)) * 100)}% more followers than those are ${worstAmount}`);
  console.log("\n");
}

try {
  var bayesData = fs.readJsonSync('./bayesData.json');
  this.followersData = fs.readJsonSync('./followersData.json');
} catch (e) {
}
if (bayesData) {
  classifier = bayes.fromJson(bayesData);
}
if (this.followersData) {
  calculateHappiness(this.followersData);
}

nconf.file({ file: 'config.json' }).env();

var twitter = new Twit({
  consumer_key: nconf.get('TWITTER_CONSUMER_KEY'),
  consumer_secret: nconf.get('TWITTER_CONSUMER_SECRET'),
  access_token: nconf.get('TWITTER_ACCESS_TOKEN'),
  access_token_secret: nconf.get('TWITTER_ACCESS_TOKEN_SECRET')
});


function prompt(question, callback) {
  var stdin = process.stdin,
    stdout = process.stdout;

  stdin.resume();
  stdout.write(question);

  stdin.once('data', function (data) {
    callback(data.toString().trim());
  });
}

var testRegex = '(.*I had.*|.*(I am))|(.*( day).*)|(.*( feel).*)|(I.*now|.*I)';
var tweetStream = twitter.stream('statuses/filter', { track: ['I'], language: 'en' });
this.tweetsArray = [];
this.done = true;


tweetStream.on('tweet', (tweet) => {
  const tweetText = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.retweeted_status ? tweet.retweeted_status.text : tweet.text;
  if (new RegExp(testRegex).test(tweetText)) {
    tweet.text = tweetText.replace(/(http.+(\S|\b|\n))/g, '').trim();
    if (this.tweetsArray.length <= 10) {
      request(`http://www.purgomalum.com/service/json?text=${encodeURIComponent(tweet.text)}`, (error, response, body) => {
        var newText = JSON.parse(body).result;
        tweet.safeText = decodeURIComponent(newText);
        this.tweetsArray.push(tweet);
      });
    }
  }
});

function categorize(tweet) {
  return classifier.categorize(tweet);
}
app.get('/', function (req, res) {
  res.sendFile('home.html', { root: __dirname });
})

db.connect(db.MODE_PRODUCTION, function (err) {
  if (err) {
    console.log('Unable to connect to MySQL.')
    process.exit(1)
  } else {
    app.listen(8080, function () {
      console.log('Listening on port 8080...')
    })
  }
})

app.get('/tweet', (req, res) => {
  res.json(this.tweetsArray[0]);
  this.tweetsArray.shift();
})

app.get('/categorize', (req, res) => {
  if (!req.query.tweet) return res.sendStatus(400);
  const tweet = req.query.tweet;
  res.json(categorize(JSON.parse(tweet).text));
})

app.post('/train', (req, res) => {
  var tweetString = req.body.tweet;
  const category = req.body.category;
  var tweetObject = JSON.parse(tweetString);
  if (!tweetObject || !category || !tweetObject.text) return res.sendStatus(400);
  if (category == "p") classifier.learn(tweetObject.text, 'positive');
  else if (category == "n") classifier.learn(tweetObject.text, 'negative');
  var stateJson = classifier.toJson();
  this.followersData[category].push({ followers: tweetObject.user.followers_count, username: tweetObject.user.screen_name })
  try {
    fs.writeJSONSync('./bayesData.json', stateJson)
    fs.writeJSONSync('./followersData.json', this.followersData)
  } catch (e) {
    res.sendStatus(400);
  }
  res.sendStatus(200);
})

