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
	res.render('index', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection'});
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
				+ primary_column + ' LIKE \'' + search_param + '%\' ORDER BY ' + primary_column + '', "", function(err, result) {
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
				data += "<tr><td><a href=\"/words/" + row.primary.replace(/ /g, '+') + "\">" + row.primary + "</a></td></tr>";
			}, this);
			data += "</tbody>";
		}
		data += "</table>";
		pool.query('SELECT ' + primary_column + ' as primary, ' + secondary_column + ' as secondary FROM wordlist \
			WHERE ' + primary_column + ' LIKE concat(left(\'' + search_param + '\',1),\'%\') \
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
						data += "<tr><td><a href=\"/words/" + row.primary.replace(/ /g, '+') + "\">" + row.primary + "</a></td></tr>";
					}, this);
					data += "</tbody>";
				}
				data += "</table>";
				res.send(data);
		});
	});
});

// parameter middleware that will run before the next routes
app.param('word', function(req, res, next, word) {

    // check if the user with that name exists
    // do some validations
    // add -dude to the name
    var modified = word.replace(/\+/g, ' ');

    // save name to the request
    req.name = modified;

    next();
});

app.get("/words/:word", function(req, res) {
	word = req.params.word.replace(/\+/g, ' ');
	pool.query('(SELECT english_word, part_of_speech FROM wordlist WHERE english_word LIKE \'' + word 
	+ ' %\') UNION ALL (SELECT english_word, part_of_speech FROM wordlist WHERE english_word LIKE \'% ' + word 
	+ '\') UNION ALL (SELECT english_word, part_of_speech FROM wordlist WHERE english_word LIKE \'% ' + word + '%\')',
	'', function(suggest_err, suggest_result) {
		if(suggest_err) {
			return console.error('error running query', suggest_err);
		}
		pool.query('SELECT konkani_word, part_of_speech FROM wordlist WHERE english_word LIKE \'' + word 
			+ '\'', '', function(main_err, main_result) {
			if(main_err) {
				return console.error('error running query', main_err);
			}
			res.render('word', 
				{ title: 'A Southern Konkani Vocabulary Collection', 
				  heading: 'A Southern Konkani Vocabulary Collection', 
				  query: word, 
				  words: main_result.rows,
				  related_words: suggest_result.rows
				});
		});
	});
});

app.listen(3000);