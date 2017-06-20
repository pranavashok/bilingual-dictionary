const pool = require('./lib/db');
var express = require('express')
var app = express()
var path = require('path');

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

app.get('/', function (req, res) {
  	pool.query('SELECT konkani_word, english_word, subcategory FROM wordlist',"" , function(err, result) {
		if(err) {
			return console.error('error running query', err);
		}
		
		res.render('index', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection', wordlist: result.rows});
	});
})

app.get('/searching', function(req, res) {
	val = req.query.search;
	pool.query('SELECT konkani_word, english_word, subcategory FROM wordlist WHERE konkani_word LIKE \'' + val + '%\' OR english_word LIKE \'' + val + '%\'', '' , function(err, result) {
	if(err) {
		return console.error('error running query', err);
	}
	data = "";
	result.rows.forEach(function(row) {
		data += row.konkani_word + " " + row.english_word + "<br />";
	}, this);
	res.send(data);
	});
});


app.listen(3000);