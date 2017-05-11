var express = require('express');
const app = express();

var db = require('./db')

app.get('/',function(req,res){
    res.sendFile('home.html', { root: __dirname });
})

db.connect(db.MODE_PRODUCTION, function(err) {
  if (err) {
    console.log('Unable to connect to MySQL.')
    process.exit(1)
  } else {
    app.listen(8080, function() {
      console.log('Listening on port 3000...')
    })
  }
})