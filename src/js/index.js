import React, { Component } from 'react';
import logo from './applia_icon.png';
import './App.css';

const local = true;
const IP = local ? "localhost" : "35.187.165.232";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      attemptedCat: "Loading",
      tweetText: "Loading Tweet",
      tweetSafeText: "Loading...",
      tweet: null,
      posAvg: null,
      negAvg: null
    };
  }
  componentWillMount() {
    this.getNewTweet();
  }

  trainTweetForCategory(tweet, category, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', `http://${IP}:8080/train`, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    var stringTweet = encodeURIComponent(JSON.stringify(this.state.tweet));
    xhr.send(`tweet=${stringTweet}&category=${category}`);
    xhr.onreadystatechange = (e) => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        callback();
      } else callback(e || "ERROR");
    };
  }

  getNewTweet() {
    this.getTweetAnaylsis();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', `http://${IP}:8080/tweet`, true);
    xhr.send();
    xhr.onreadystatechange = (e) => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        const tweetObj = JSON.parse(xhr.response);
        this.setState({ tweet: tweetObj, tweetText: tweetObj.text, tweetSafeText: tweetObj.safeText })
        this.getCategory(xhr.responseText);
      }
    };
  }

  getCategory(tweet) {
    var xhr = new XMLHttpRequest();
    var encodedTweet = encodeURIComponent(tweet);
    xhr.open('GET', `http://${IP}:8080/categorize?tweet=${encodedTweet}`, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.send();
    xhr.onreadystatechange = (e) => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        this.setState({ attemptedCat: xhr.responseText });
      }
    };
  }

  pressedButton(input) {
    if (!input) return this.getNewTweet();
    this.trainTweetForCategory(this.state.tweetText, input, (err) => {
      if (!err) {
        this.getNewTweet();
      }
    })
  }

  getTweetAnaylsis() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', `http://${IP}:8080/analysis`, true);
    xhr.send();
    xhr.onreadystatechange = (e) => {
      if (xhr.readyState == 4 && xhr.status == 200) {
        const tweetObj = JSON.parse(xhr.response);
        this.setState({ posAvg: parseInt(tweetObj.posAvg), negAvg: parseInt(tweetObj.negAvg) })
      }
    };
  }


  render() {
    const betterAmount = this.state.posAvg > this.state.negAvg ? "happy" : "not happy";
    const worstAmount = this.state.posAvg < this.state.negAvg ? "happy" : "not happy";
    var twitterStatement = `Users who are ${betterAmount} have ${Math.round((Math.abs(this.state.posAvg - this.state.negAvg) / Math.max(this.state.posAvg, this.state.negAvg)) * 100)}% more followers than those are ${worstAmount}`;
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to Applia.io</h2>
        </div>
        <p className="App-intro">
          <div>Current Tweet: {this.state.tweetSafeText.replace(/^"(.+(?="$))"$/, '$1')}</div>
          <div>Attempted categorization: {this.state.attemptedCat.replace(/^"(.+(?="$))"$/, '$1')} </div>
          <button style={{ margin: 5 }} onClick={() => this.pressedButton('positive')}>Positive</button>
          <button style={{ margin: 5 }} onClick={() => this.pressedButton('negative')}>Negative</button>
          <button style={{ margin: 5 }} onClick={() => this.pressedButton()}>Skip</button>
          <div>
            <p>Average of followers of users who are positive: {this.state.posAvg}</p>
            <p>Average of followers of users who are negative: {this.state.negAvg}</p>
          </div>
          <div>
            {twitterStatement}
          </div>
        </p>
      </div>
    );
  }
}

export default App;
