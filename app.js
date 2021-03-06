require('babel-register');
var express = require('express');
var bodyParser = require('body-parser')
var nconf = require('nconf');
var Twit = require('twit');
var _ = require('lodash');
var bayes = require('bayes');
var classifier = bayes();
var fs = require('fs-extra');
var request = require('request');
var db = require('./db')
const app = express();
this.followersData = [];

nconf.file({ file: 'config.json' }).env();

var twitter = new Twit({
  consumer_key: nconf.get('TWITTER_CONSUMER_KEY'),
  consumer_secret: nconf.get('TWITTER_CONSUMER_SECRET'),
  access_token: nconf.get('TWITTER_ACCESS_TOKEN'),
  access_token_secret: nconf.get('TWITTER_ACCESS_TOKEN_SECRET')
});
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

var server = app.listen(process.env.PORT || 8080, function () {
  var port = server.address().port;
  console.log("App now running on port", port);
});

// parse application/json
app.use(bodyParser.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

db.getFollowersData((followersData) => {
  this.followersData = followersData;
});

var testRegex = '(.*I had.*|.*(I am))|(.*( day).*)|(.*( feel).*)|(I.*now|.*I)';
var tweetStream = twitter.stream('statuses/filter', { track: ['I'], language: 'en' });
this.tweetsArray = [];


tweetStream.on('tweet', (tweet) => {
  const tweetText = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.retweeted_status ? tweet.retweeted_status.text : tweet.text;
  if (new RegExp(testRegex).test(tweetText)) {
    tweet.text = tweetText.replace(/(http.+(\S|\b|\n))/g, '').trim();
    if (this.tweetsArray.length <= 10) {
      request(`http://www.purgomalum.com/service/json?text=${encodeURIComponent(tweet.text)}`, (error, response, body) => {
        try {
          var newText = JSON.parse(body).result;
          tweet.safeText = newText;
        } catch (e) {
          tweet.safeText = tweet.text;
        }
        this.tweetsArray.push(tweet);
      });
    }
  }
});


function calculateHappiness(dataArray, done) {
  var totalPos = 0;
  var totalNeg = 0;
  var totalPosRecorded = 0;
  var totalNegRecorded = 0;
  for (var tweet of dataArray) {
    if (tweet.classifier == "negative") {
      totalNegRecorded++;
      totalNeg += parseInt(tweet.amount);
    }
    else if (tweet.classifier == "positive") {
      totalPosRecorded++;
      totalPos += parseInt(tweet.amount);
    }
  }
  const posAvg = totalPos / totalPosRecorded;
  const negAvg = totalNeg / totalNegRecorded;

  var statementObject = {
    posAvg,
    negAvg
  }
  done(statementObject);
}

function categorize(tweet) {
  return classifier.categorize(tweet);
}

db.getBayesFromDB((bayesData) => {
  if (bayesData) {
    classifier = bayes.fromJson(JSON.stringify(bayesData));
  }
})

app.get('/', function (req, res) {
  res.sendFile('home.html', { root: __dirname });
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
  classifier.learn(tweetObject.text, category);
  try {
    db.insertFollower(tweetObject.user.followers_count, tweetObject.user.screen_name, category);
    db.updateCountsInstance(JSON.parse(classifier.toJson()));
    db.updateVocabInstance(JSON.parse(classifier.toJson()));
    db.getFollowersData((followersData) => {
      this.followersData = followersData;
    });
    console.log("UPDATED DB");
  } catch (e) {
    console.log(e)
  }
  res.sendStatus(200);
  res.end();
})

app.get('/analysis', (req, res) => {
  calculateHappiness(this.followersData, (resObj) => {
    res.json(resObj);
  })
});