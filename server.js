var express    = require('express'),
    mysql      = require('mysql');
const app = express();

var connection = mysql.createConnection({
  host: '35.188.96.16',
  user: 'jay',
  password: 'donkey',
  database: 'bigstars'
})

connection.connect(function(err) {
  if (err) throw err
  console.log('You are now connected...')
})

app.get('/', (req, res) => {
  res.send('Mike is Gay');
});

const server = app.listen(8080, () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log(`Example app listening at http://${host}:${port}`);
});