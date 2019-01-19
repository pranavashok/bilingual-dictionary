require('dotenv').config({path : 'config.env'});

var express = require('express')
var app = express()
var path = require('path');

var azure = require('azure-storage');

var config = {
   storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
   storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
   connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
   db1: "dictengtokon",
   db2: "dictkontoeng"
};

var tableService = azure.createTableService();

app.set('ipaddress', (process.env.NODEJS_IP || "0.0.0.0"));
app.set('port', (process.env.NODEJS_PORT || 8080));

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

app.locals.pretty = true;

app.use(function(req, res, next) {
	res.locals.user = req.user;
	next();
});

app.get('/', function (req, res) {	
	res.render('index', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection'});
})

app.get('/about|/suggest|/contact', function (req, res) {	
	res.render('contact', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection'});
})

function unique_by_column(entries, column) {
	unique_entries = [];
	current_word = "";
	entries.forEach(function(row) {
		if (current_word == row[column]._) {
			duplicate = true;
		} else {
			duplicate = false;
		}
		if (!duplicate) {
			unique_entries.push(row);
			current_word = row[column]._;
		}
	}, this);
	return unique_entries;
}

// Next word in dict order
function next_word(word) {
	length = word.length - 1;
	word_upper = word.substring(0, length) + String.fromCharCode(word[length].charCodeAt() + 1)
	return word_upper;
}

app.get('/searching', function(req, res) {
	search_param = req.query.search;

	// If typing in English, then
	if (search_param.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
		primary_table = db1;
		secondary_table = db2;
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
		primary_table = db1;
		secondary_table = db2;
	}
	
	data = "";

	var startswith_query = new azure.TableQuery()
					.select([primary_column])
					.top(30)
					.where("PartitionKey ge ? and PartitionKey lt ?", search_param, next_word(search_param));

	tableService.queryEntities(primary_table, startswith_query, null, function(error, result, response) {
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if(!error && result.entries.length > 0) {
			data += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
			data += "<tbody>";
			
			unique_entries = unique_by_column(result.entries, primary_column);
			unique_entries.forEach(function(row) {
				data += "<tr><td><a href=\"/words/" + row[primary_column]._.replace(/ /g, '+') + "\">" + row[primary_column]._ + "</a></td></tr>";
			}, this);
			data += "</tbody>";
		} else {
			data += "<thead><tr><td>No exact matches</td></tr></thead>";
			data += "</thead>";
		}
		data += "</table>";


		// TODO: Suggested results
		// 1. Ignore first word and pick stuff which are edit distance close, order them alphabetically
		// 2. Pick words which contain query in any way (query %), (% query) or (% query %)

		// data += "<table class=\"results-table\" id=\"suggested-results-table\">";
		// if (result.rows.length == 0) {
		// 	data += "<thead><tr><td>Try another query</td></tr></thead>";
		// 	data += "</thead>";
		// } else {
		// 	data += "<thead><tr><td>Suggested matches</td></tr></thead>";
		// 	data += "<tbody>";
		// 	result.rows.forEach(function(row) {
		// 		data += "<tr><td><a href=\"/words/" + row.primary.replace(/ /g, '+') + "\">" + row.primary + "</a></td></tr>";
		// 	}, this);
		// 	data += "</tbody>";
		// }
		// data += "</table>";

		res.send(data);
	});
});

app.get("/words/:word", function(req, res) {
	word = req.params.word.replace(/\+/g, ' ');
	// If typing in English, then
	if (word.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
		primary_table = "dictengtokon";
		secondary_table = "dictkontoeng";
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
		primary_table = "dictkontoeng";
		secondary_table = "dictengtokon";
	}

	// TODO: Update browse_count

	// TODO: Related words, same subcategory words

	var exact_word_query = new azure.TableQuery()
					.select([secondary_column, 'part_of_speech', 'more_details'])
					.where("PartitionKey ge ? and PartitionKey lt ? and " + primary_column + " eq ?", word, next_word(word), word);

	tableService.queryEntities(primary_table, exact_word_query, null, function(error, result, response) {
		
		// TODO: Related words
		// Pick words which contain query in any way (query %), (% query) or (% query %)

		// TODO: Same subcategory words

		if(!error && result.entries.length > 0) {
			res.render('words', 
					{ title: 'A Southern Konkani Vocabulary Collection', 
					heading: 'A Southern Konkani Vocabulary Collection', 
					query: word, 
					words: result.entries,
					related_words: [],
					same_subcat_words: []
			});
		} else {
			res.render('words', 
					{ title: 'A Southern Konkani Vocabulary Collection', 
					heading: 'A Southern Konkani Vocabulary Collection', 
					query: word, 
					words: [],
					related_words: [],
					same_subcat_words: []
			});
		}
	});	
});

app.listen(app.get('port'), app.get('ipaddress'), function() {
	console.log('App is running, server is listening on host:port ', app.get('ipaddress'), ':', app.get('port'));
});
