const pool = require('./lib/db');
var express = require('express')
var app = express()
var path = require('path');

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

app.locals.pretty = true;

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
	pool.query('SELECT DISTINCT ' + primary_column + ' as primary FROM wordlist WHERE ' 
				+ primary_column + ' LIKE LOWER(\'' + search_param + '%\') ORDER BY ' + primary_column + '', "", function(err, result) {
		if(err) {
			return console.error('error running query', err);
		}
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if (result.rows.length == 0) {
			pool.query('INSERT INTO searchlog (word, ipaddress) VALUES (\'' + search_param + '\', \'' + req.ip + '\');', "", function(err, result) {
				if(err) {
					return console.error('error running query', err);
				}
			});
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
		/**
		 * Suggested results
		 * 1. Ignore first word and pick stuff which are edit distance close, order them alphabetically
		 * 2. Pick words which contain query in any way (query %), (% query) or (% query %)
		 */ 
		pool.query('(SELECT DISTINCT ' + primary_column + ' as primary FROM wordlist \
			WHERE ' + primary_column + ' LIKE lower(concat(left(\'' + search_param + '\',1),\'%\')) \
			AND levenshtein(right(' + primary_column + ', -1), lower(right(\'' + search_param + '\', -1))) BETWEEN 1 AND 3 \
			ORDER BY ' + primary_column + ' LIMIT 10)' + 
			'UNION ALL (SELECT suggested_word AS primary FROM ((SELECT DISTINCT ' + primary_column + ' AS suggested_word, part_of_speech FROM wordlist WHERE ' 
			+ primary_column + ' LIKE LOWER(\'' + search_param + ' %\')) UNION (SELECT DISTINCT ' + primary_column 
			+ ' AS suggested_word, part_of_speech FROM wordlist WHERE ' + primary_column + ' LIKE LOWER(\'% ' + search_param 
			+ '\')) UNION (SELECT DISTINCT ' + primary_column + ' AS suggested_word, part_of_speech FROM wordlist WHERE ' 
			+ primary_column + ' LIKE LOWER(\'% ' + search_param + '%\'))) as table1 ORDER BY suggested_word)', "", function(err, result) {
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

app.get("/words/:word", function(req, res) {
	word = req.params.word.replace(/\+/g, ' ');
	// If typing in English, then
	if (word.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
	}

	pool.query('UPDATE wordlist SET browse_count = browse_count + 1 WHERE ' + primary_column + ' LIKE \'' + word + '\'', '', function(err,res) {
		if (err) {
			return console.error('error updating browse count', err);
		}
	});

	pool.query('SELECT suggested_word FROM ((SELECT DISTINCT ' + primary_column + ' AS suggested_word, part_of_speech FROM wordlist WHERE ' + primary_column + ' LIKE LOWER(\'' + word 
	+ ' %\')) UNION (SELECT DISTINCT ' + primary_column + ' AS suggested_word, part_of_speech FROM wordlist WHERE ' + primary_column + ' LIKE LOWER(\'% ' + word 
	+ '\')) UNION (SELECT DISTINCT ' + primary_column + ' AS suggested_word, part_of_speech FROM wordlist WHERE ' + primary_column + ' LIKE LOWER(\'% ' + word + '%\'))) as table1 ORDER BY suggested_word',
	'', function(suggest_err, suggest_result) {
		if(suggest_err) {
			return console.error('error running query', suggest_err);
		}
		pool.query('SELECT ' + secondary_column + ' AS translated_word, part_of_speech, more_details FROM wordlist WHERE ' + primary_column + ' LIKE LOWER(\'' + word 
			+ '\')', '', function(main_err, main_result) {
			if(main_err) {
				return console.error('error running query', main_err);
			}
			pool.query('SELECT DISTINCT ' + primary_column + ' AS word_in_same_cat, subcategory FROM wordlist WHERE subcategory IN (SELECT subcategory FROM wordlist WHERE ' 
				+ primary_column + ' LIKE LOWER(\'' + word + '\') LIMIT 1) ORDER BY ' + primary_column, '', function(same_subcat_err, same_subcat_result) {
				res.render('words', 
					{ title: 'A Southern Konkani Vocabulary Collection', 
				  	heading: 'A Southern Konkani Vocabulary Collection', 
				  	query: word, 
				  	words: main_result.rows,
				  	related_words: suggest_result.rows,
					same_subcat_words: same_subcat_result.rows
				});
			});
		});
	});
});

app.listen(3000);