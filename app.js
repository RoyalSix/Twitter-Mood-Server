require('babel-register');
var express = require('express');
const app = express();
app.use(function(req, res, next) {
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
var followersData = [];

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
  followersData = fs.readJsonSync('./followersData.json');
} catch (e) {
}
if (bayesData) {
  classifier = bayes.fromJson(bayesData);
}
if (followersData) {
  calculateHappiness(followersData);
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
    if (this.tweetsArray.length <= 10) this.tweetsArray.push(tweet.text);
  }
});
// prompt('Enter any key to start tweet training', (input) => {
//   tweetStream.on('tweet', (tweet) => {
//     const tweetText = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.retweeted_status ? tweet.retweeted_status.text : tweet.text;
//     if (new RegExp(testRegex).test(tweetText)) {
//       if (this.done && this.tweetsArray.length > 0) trainData();
//       else this.tweetsArray.push(tweet);
//     }
//   });
// });

const trainData = () => {
  this.done = false;
  if (this.tweetsArray) {
    const tweet = this.tweetsArray[0];
    var tweetText = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.retweeted_status ? tweet.retweeted_status.text : tweet.text;
    tweetText = tweetText.replace(/(http.+(\S|\b|\n))/g, '').trim();
    console.log('\n');
    console.log('tweet: ', tweetText);
    console.log('\n');
    console.log("Attempted categorization: ", classifier.categorize(tweetText))
    prompt('Enter p for positive, n for negative or press enter to skip ', (input) => {
      if (input == "p") classifier.learn(tweetText, 'positive');
      else if (input == "n") classifier.learn(tweetText, 'negative');
      var stateJson = classifier.toJson();
      input = input || "neu";
      if (input != "neu") followersData[input].push({ followers: tweet.user.followers_count, username: tweet.user.screen_name })
      try {
        fs.writeJSONSync('./bayesData.json', stateJson)
        fs.writeJSONSync('./followersData.json', followersData)
      } catch (e) {
        console.log(e);
      }
      this.done = true;
      if (this.tweetsArray.length > 0) {
        this.tweetsArray.shift();
        trainData();
      }
    });
  }
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
