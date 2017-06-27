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
	search_param = req.query.search;
	// If typing in English, then
	if (search_param.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
	}
	
	data = "";
	pool.query('SELECT ' + primary_column + ' as primary, ' + secondary_column + ' as secondary FROM wordlist WHERE ' 
				+ primary_column + ' LIKE \'' + search_param + '%\' ORDER BY ' + primary_column + ' LIMIT 8', "", function(err, result) {
		if(err) {
			return console.error('error running query', err);
		}
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if (result.rows.length == 0) {
			data += "<thead><tr><td>No exact matches</td></tr></thead>";
			data += "</thead>";
		} else {
			data += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
			data += "<tbody>";
			result.rows.forEach(function(row) {
				data += "<tr><td>" + row.primary + "</td><td>" + row.secondary + "</td></tr>";
			}, this);
			data += "</tbody>";
		}
		data += "</table>";
		pool.query('SELECT ' + primary_column + ' as primary, ' + secondary_column + ' as secondary FROM wordlist \
			WHERE ' + primary_column + ' LIKE \'' + search_param + '%\' \
			AND levenshtein(right(' + primary_column + ', -1), right(\'' + search_param + '\', -1)) BETWEEN 1 AND 2 \
			ORDER BY ' + primary_column + ' LIMIT 8', "", function(err, result) {
				if(err) {
					return console.error('error running query', err);
				}
				data += "<table class=\"results-table\" id=\"suggested-results-table\">";
				if (result.rows.length == 0) {
					data += "<thead><tr><td>Try another query</td></tr></thead>";
					data += "</thead>";
				} else {
					data += "<thead><tr><td>Suggested matches</td></tr></thead>";
					data += "<tbody>";
					result.rows.forEach(function(row) {
						data += "<tr><td>" + row.primary + "</td><td>" + row.secondary + "</td></tr>";
					}, this);
					data += "</tbody>";
				}
				data += "</table>";
				res.send(data);
		});
	});
});


app.listen(3000);