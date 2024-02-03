import dotenv from "dotenv";
dotenv.config({ path: "config.env" });

import express from "express";
const app = express();

import path from "path";
import cors from "cors";

import Rollbar from "rollbar";

// For mailing
import nodemailer from "nodemailer";
import dateTime from "node-datetime";
import bodyParser from "body-parser";

import {
  TableClient,
  TableServiceClient,
  AzureNamedKeyCredential,
} from "@azure/data-tables";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TODO: express-recaptcha

const config = {
  storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
  storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  // Rollbar
  post_client_item: process.env.POST_CLIENT_ITEM_ACCESS_TOKEN,
  post_server_item: process.env.POST_SERVER_ITEM_ACCESS_TOKEN,
  env: process.env.NODE_ENV,
  db1: "dictengtokon",
  db2: "dictkontoeng",
};

const account = config.storageAccount;
const accountKey = config.storageAccessKey;

const credential = new AzureNamedKeyCredential(account, accountKey);
const tableServiceClient = new TableServiceClient(
  `https://${account}.table.core.windows.net`,
  credential
);

// var tableService = azure.createTableService();
app.set("ipaddress", process.env.IP || "0.0.0.0");
app.set("port", process.env.PORT || 8080);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(cors());
app.options("*", cors());

app.use(express.static(path.join(__dirname, "public")));

// var robots = require('express-robots-txt');
// app.use(robots({UserAgent: '*', Disallow: ''}));

app.locals.pretty = true;
app.locals.env = config.env;
app.locals.post_client_item = config.post_client_item;

app.use(function (req, res, next) {
  res.locals.user = req.user;
  next();
});

// initialize the rollbar library with your access token
var rollbar = new Rollbar({
  accessToken: config.post_server_item,
  captureUncaught: true,
  captureUnhandledRejections: true,
  payload: {
    environment: config.env,
  },
  verbose: true, // This will now log to console.log, as well as Rollbar
});

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get("/", function (req, res) {
  res.render("index", {
    title: "A Southern Konkani Vocabulary Collection",
    heading: "A Southern Konkani Vocabulary Collection",
    heading_konkani: "दक्षिण कोंकणी उतरावळि",
  });
});

app.get("/about", function (req, res) {
  res.render("about", {
    title: "A Southern Konkani Vocabulary Collection",
    heading: "A Southern Konkani Vocabulary Collection",
    heading_konkani: "दक्षिण कोंकणी उतरावळि",
  });
});

app.get("/contact", function (req, res) {
  res.render("contact", {
    title: "A Southern Konkani Vocabulary Collection",
    heading: "A Southern Konkani Vocabulary Collection",
    heading_konkani: "दक्षिण कोंकणी उतरावळि",
  });
});

app.get("/suggest", function (req, res) {
  res.render("suggest", {
    title: "A Southern Konkani Vocabulary Collection",
    heading: "A Southern Konkani Vocabulary Collection",
    heading_konkani: "दक्षिण कोंकणी उतरावळि",
  });
});

app.get("/contents", function (req, res) {
  res.render("contents", {
    title: "A Southern Konkani Vocabulary Collection",
    heading: "A Southern Konkani Vocabulary Collection",
    heading_konkani: "दक्षिण कोंकणी उतरावळि",
  });
});

app.post("/submit-suggestion", function (req, res) {
  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    service: "Zoho",
    host: this.service,
    port: 587,
    secureConnection: false, // use SSL
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      ciphers: "SSLv3",
    },
  });

  var dt = dateTime.create();
  var formatted = dt.format("Y-m-d H:M:S");

  var name = req.body.name;
  var email = req.body.email;
  var suggestion = req.body.suggestion;

  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: "dict@suryaashok.in", // sender address
    to: "mail@suryaashok.in", // list of receivers
    subject: "Suggestion submitted on " + formatted, // Subject line
    text:
      "Name: " +
      name +
      "; Email: " +
      email +
      "; Suggestion/feedback: " +
      suggestion, // plaintext body
    html:
      "<strong>Name: </strong>" +
      name +
      "<br /><br />" +
      "<strong>Email: </strong>" +
      email +
      "<br /><br />" +
      "<strong>Suggestion/feedback</strong><br />" +
      suggestion +
      "<br />", // html body
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      rollbar.error(
        "Error occured when sending mail",
        error,
        { mailoptions: mailOptions },
        req
      );
      return res.send(-1);
    }
    console.log("Message %s sent: %s", info.messageId, info.response);
    res.send(info.response);
  });
});

async function retrieveEntity(table, partitionKey, rowKey) {
  const tableClient = new TableClient(
    tableServiceClient.url,
    table,
    credential
  );
  const entity = await tableClient.getEntity(partitionKey, rowKey);
  return entity;
}

async function queryEntities(table, query) {
  const tableClient = new TableClient(
    tableServiceClient.url,
    table,
    credential
  );
  const entities = tableClient.listEntities({
    queryOptions: {
      select: query.select,
      top: query.top,
      filter: query.filter,
    },
  });
  const result = [];
  for await (const entity of entities) {
    result.push(entity);
  }
  return result;
}

async function insertEntity(table, entity) {
  const tableClient = tableServiceClient.getTableClient(table);
  await tableClient.createEntity(entity);
}

function group_by_subcat(entries) {
  const groups = new Map();

  entries.forEach((row) => {
    if (!row.hasOwnProperty("english_subcategory")) {
      return;
    }

    const key = row.english_subcategory;

    if (groups.has(key)) {
      groups.get(key).push(row);
    } else {
      groups.set(key, [row]);
    }
  });

  // If you need the groups as an array of arrays, you can convert it here
  return Array.from(groups.values());
}

function remove_duplicate_by_word_and_category(req, result, column) {
  const unique = new Map();
  const keep_rows = [];

  result.forEach(function (row) {
    if (!row.hasOwnProperty(column)) {
      rollbar.error(
        "Error: column doesn't exist in row",
        { row: row, column: column },
        req
      );
      return result;
    }

    const word = row[column];
    const category = row.english_subcategory ? row.english_subcategory : null;

    if (!unique.has(word) || unique.get(word) !== category) {
      unique.set(word, category);
      keep_rows.push(row);
    } else {
      const index = keep_rows.findIndex(
        (item) => item[column] === word && item.english_subcategory === category
      );

      if (
        index !== -1 &&
        row.part_of_speech &&
        keep_rows[index].part_of_speech &&
        row.part_of_speech === keep_rows[index].part_of_speech &&
        row.more_details &&
        keep_rows[index].more_details &&
        row.more_details !== keep_rows[index].more_details
      ) {
        keep_rows[index].more_details = combine_more_details(
          row.more_details,
          keep_rows[index].more_details
        );
      } else {
        keep_rows.push(row);
      }
    }
  });

  return keep_rows;
}

function remove_nonsearchable(entries, column, num) {
  const keep_rows = entries.filter(
    (row) =>
      !row.hasOwnProperty("searchable") ||
      (row.searchable !== num && row.searchable !== String(num))
  );
  return keep_rows;
}

function combine_more_details(m1, m2) {
  if (m1 === "") {
    return m2;
  }
  if (m2 === "") {
    return m1;
  }

  try {
    m1 = JSON.parse(m1);
    m2 = JSON.parse(m2);
  } catch (ex) {
    console.error("Exception in combining more_details: ", ex);
    return null; // or handle this case differently
  }

  return JSON.stringify(Object.assign({}, m1, m2));
}

function unique_entries_by_column(req, entries, column) {
  const unique_words = new Set();
  const unique_entries = entries.filter((row) => {
    if (!row.hasOwnProperty(column)) {
      rollbar.error(
        "unique_entries_by_column() failed 2",
        { entries: entries, column: column },
        req
      );
      return false;
    }
    const word = row[column];
    if (!unique_words.has(word)) {
      unique_words.add(word);
      return true;
    }
    return false;
  });
  return unique_entries;
}

function unique_words_by_column(entries, column) {
  const unique_words = new Set();
  entries.forEach(function (row) {
    if (row[column]) {
      unique_words.add(row[column]);
    }
  });
  return Array.from(unique_words);
}

function sort_entries_by_column(entries, column) {
  return entries.sort((e1, e2) => {
    if (e1.hasOwnProperty(column) && e2.hasOwnProperty(column)) {
      return e1[column] - e2[column];
    } else {
      return 0;
    }
  });
}

function next_word(word) {
  if (word === "") {
    return word;
  }
  const length = word.length - 1;
  const word_upper =
    word.substring(0, length) +
    String.fromCharCode(word.charCodeAt(length) + 1);
  return word_upper;
}

app.get("/searching", async function (req, res) {
  const search_param = req.query.search;

  // Handle empty requests
  if (search_param === "") {
    res.send("");
    return;
  }

  // If typing in English, then
  let primary_column,
    secondary_column,
    primary_table,
    secondary_table,
    suggest_table;
  if (search_param.search(/^([\x00-\xFF]+)/) != -1) {
    primary_column = "english_word";
    secondary_column = "konkani_word";
    primary_table = config.db1;
    secondary_table = config.db2;
    suggest_table = "suggesteng";
  } else {
    primary_column = "konkani_word";
    secondary_column = "english_word";
    primary_table = config.db2;
    secondary_table = config.db1;
    suggest_table = "suggestkon";
  }

  var data = "";

  const startswith_query = {
    select: [primary_column, "searchable"],
    top: 30,
    filter: `PartitionKey ge '${search_param.toLowerCase()}' and PartitionKey lt '${next_word(
      search_param
    ).toLowerCase()}'`,
  };

  const containingwords_query = {
    select: ["RowKey", "ParentWord", "StrippedWord"],
    top: 30,
    filter: `PartitionKey ge '${search_param.toLowerCase()}' and PartitionKey lt '${next_word(
      search_param
    ).toLowerCase()}'`,
  };

  try {
    const startswith_result = await queryEntities(
      primary_table,
      startswith_query
    );
    data += createTable(
      startswith_result,
      primary_column,
      "Dictionary-style matches"
    );

    const containingwords_result = await queryEntities(
      suggest_table,
      containingwords_query
    );
    data += createTable(
      containingwords_result,
      "ParentWord",
      "Suggested matches"
    );

    res.send(data);
  } catch (error) {
    rollbar.error("Error occured when querying entities", error, req);
    res.send("An error occurred. Please try again later.");
  }

  // Log searches
  if (search_param.length >= 3 && config.env === "production") {
    var task = {
      PartitionKey: { _: primary_column, $: "Edm.String" },
      RowKey: { _: String(Date.now()), $: "Edm.String" },
      query: { _: search_param, $: "Edm.String" },
      complete: { _: false, $: "Edm.Boolean" },
    };
    try {
      await insertEntity("searchlog", task);
    } catch (error) {
      rollbar.error(
        "Error occured when inserting entity into searchlog",
        error,
        { entity: task },
        req
      );
    }
  }
});

function createTable(result, column, header) {
  let data = '<table class="results-table">';
  if (result.length > 0) {
    data += `<thead><tr><td>${header}</td></tr></thead>`;
    data += "<tbody>";
    const searchable_entries = remove_nonsearchable(result, column, 0);
    const unique_words = unique_words_by_column(searchable_entries, column);
    unique_words.forEach(function (word) {
      data += `<tr><td><a href="/words/${word.replace(
        / /g,
        "+"
      )}">${word}</a></td></tr>`;
    });
    data += "</tbody>";
  } else {
    data += "<thead><tr><td>No matches found</td></tr></thead>";
  }
  data += "</table>";
  return data;
}

function renderWordPage(res, word, words, related_words, same_subcat_words) {
  res.render(
    "words",
    {
      title: "A Southern Konkani Vocabulary Collection",
      heading: "A Southern Konkani Vocabulary Collection",
      heading_konkani: "दक्षिण कोंकणी उतरावळि",
      query: word,
      words: words,
      related_words: related_words,
      same_subcat_words: same_subcat_words,
    },
    function (err, html) {
      res.location("/words/" + word);
      res.send(html);
    }
  );
}

async function get_word(req, res, next) {
  var discover = false;
  let word;
  if (res.locals.word) {
    console.info("Random word ", res.locals.word, " chosen");
    word = res.locals.word;
    discover = true;
  } else {
    word = req.params.word;
  }

  word = word.replace(/\+/g, " ");

  // If typing in English, then
  let primary_column,
    secondary_column,
    primary_table,
    secondary_table,
    suggest_table;
  if (word.search(/^([\x00-\xFF]+)/) != -1) {
    primary_column = "english_word";
    secondary_column = "konkani_word";
    primary_table = "dictengtokon";
    secondary_table = "dictkontoeng";
    suggest_table = "suggesteng";
  } else {
    primary_column = "konkani_word";
    secondary_column = "english_word";
    primary_table = "dictkontoeng";
    secondary_table = "dictengtokon";
    suggest_table = "suggestkon";
  }

  var exact_word_query = {
    select: [
      secondary_column,
      "part_of_speech",
      "english_subcategory",
      "konkani_subcategory",
      "more_details",
    ],
    filter: `PartitionKey ge '${word.toLowerCase()}' and PartitionKey lt '${next_word(
      word
    ).toLowerCase()}' and ${primary_column} eq '${word.toLowerCase()}'`,
  };

  var containingwords_query = {
    select: ["RowKey", "ParentWord", "StrippedWord"],
    filter: `PartitionKey eq '${word.toLowerCase()}'`,
  };

  try {
    const exact_word_result = await queryEntities(
      primary_table,
      exact_word_query
    );
    if (exact_word_result.length > 0) {
      // Remove duplicates
      var main_result = remove_duplicate_by_word_and_category(
        req,
        exact_word_result,
        secondary_column
      );

      // Pick entries which contain query word in any way
      var related_entries = [];
      const containingwords_result = await queryEntities(
        suggest_table,
        containingwords_query
      );

      if (containingwords_result.length > 0) {
        related_entries = unique_entries_by_column(
          req,
          containingwords_result,
          "ParentWord"
        );
        related_entries = related_entries.filter((x) => x.ParentWord !== word);
      }

      let constraint_string = [];
      main_result.forEach(function (row) {
        constraint_string.push(
          `english_subcategory eq '${row.english_subcategory.replace(
            "'",
            "''"
          )}'`
        );
      });

      const samesubcat_query = {
        select: [
          primary_column,
          "english_subcategory",
          "konkani_subcategory",
          "weight",
        ],
        filter: constraint_string.join(" or "),
      };

      var samesubcat_entries = [];
      var all_subcat_entries = [];
      const samesubcat_result = await queryEntities(
        primary_table,
        samesubcat_query
      );

      if (samesubcat_result.length > 0) {
        all_subcat_entries = group_by_subcat(samesubcat_result);
        all_subcat_entries.forEach(function (list, index) {
          list.forEach(function (row) {
            if (!row.hasOwnProperty(primary_column)) {
              rollbar.error(
                "unique_entries_by_column() failed 3",
                { list: list, primary_column: primary_column },
                req
              );
            }
          });
          list = unique_entries_by_column(req, list, primary_column);
          all_subcat_entries[index] = sort_entries_by_column(list, "weight");
        }, all_subcat_entries);
      }

      renderWordPage(
        res,
        word,
        main_result,
        related_entries,
        all_subcat_entries
      );
    } else {
      renderWordPage(res, word, [], [], []);
    }
  } catch (error) {
    rollbar.error("get_word(): Error occured", error, req);
    renderWordPage(res, word, [], [], []);
  }
}

app.get("/words/:word", get_word);

var contentList = [
  "Living things",
  "Animal kingdom",
  "Animals",
  "Mammal",
  "Bird",
  "Reptiles and amphibians",
  "Arthropods",
  "Aquatic animals",
  "Worms and snails",
  "Body parts of animals",
  "Animal sounds",
  "Excreta of animals",
  "Animal homes",
  "Animal brood",
  "Other words related to animals",
  "Adjective related to animals",
  "Human beings",
  "Parts of human body",
  "Secretions and excretions",
  "Disease, illness, malady",
  "Symptoms and other disorders",
  "Words related to hair",
  "Words related to skin",
  "Words describing features of body",
  "Other words related to human body",
  "Plant kingdom",
  "Plant life",
  "Plants variety",
  "Flowering plants",
  "Flowers from trees",
  "Flowers from shrubs and herbs",
  "Flowers from creepers, bushes",
  "Flowers from aquatic plants",
  "Fruit plants",
  "Fruits and nuts from trees",
  "Fruits from creepers and vines",
  "Grain and pulses",
  "Medicinal plants",
  "Medicinal trees",
  "Medicinal shrubs, small trees",
  "Medicinal herbs",
  "Medicinal creepers and vines",
  "Millets",
  "Oilseeds",
  "Spices",
  "Timber trees",
  "Vegetables",
  "Leafy vegetables",
  "Vegetables on shrubs",
  "Vegetables from trees",
  "Vegetables from creepers, climbers",
  "Tubers, corms and bulbs used as vegetables",
  "Other useful trees, shrubs",
  "Plant Parts",
  "Parts of plants",
  "Parts of jackfruit tree",
  "Parts of plantain tree",
  "Parts of betel palm",
  "Parts of a coconut palm",
  "Parts of a mango tree",
  "Parts of paddy",
  "Other words related to plants",
  "Non-living things",
  "Clothing and jewellery",
  "Apparel and foot wear",
  "Types of sarees",
  "Other words related to apparel",
  "Fabric or cloth",
  "Jewellery",
  "Gems",
  "Buildings",
  "Parts of a house or building",
  "Rooms of a house",
  "Prayer room",
  "Inside house",
  "Furniture",
  "Other items inside house",
  "Sleeping paraphernalia in bedroom",
  "Kitchen",
  "Items in Kitchen",
  "Cooking oils",
  "Grocery etc.",
  "Other items in kitchen",
  "Residue, remnants",
  "Utensils and accessories",
  "Bath room",
  "Tools, instruments, weapons",
  "Outside house",
  "Language, food and culture",
  "Language",
  "Baby language",
  "Baby language nouns",
  "Baby language verbs",
  "Affectionate words for baby's body parts",
  "Words of address",
  "Compound words",
  "Compound adjectives",
  "Compound adverbs",
  "Compound nouns",
  "Echo words",
  "Languages",
  "Lexical doublets",
  "Lexical doublet adjectives",
  "Lexical doublet adverbs",
  "Lexical doublet nouns",
  "Proverbs",
  "Riddles",
  "Reduplicative words",
  "Adjective-adjective Reduplication 1",
  "Adjective-adjective Reduplication 2",
  "Adverb-adverb Reduplication",
  "Function Reduplication",
  "Noun-noun Reduplication: quantitative 1",
  "Noun-noun Reduplication: quantitative 2",
  "Noun-noun Reduplication: quantitative 3",
  "Numeral numeral Reduplication",
  "Possessive Reduplication",
  "Verb-verb Reduplication",
  "Simile",
  "Case form",
  "Idioms",
  "Imperatives",
  "Imperative verbs",
  "Negative imperatives",
  "Requesting imperatives",
  "Interrogatives",
  "Interrogative phrases",
  "Interrogative words",
  "Opposites, antonyms",
  "Onomatopoeic words",
  "Onomatopoeic adjectives",
  "Onomatopoeic adverbs",
  "Onomatopoeic nouns",
  "Onomatopoeic verbs",
  "Onomatopoeic verbs starting with letter क",
  "Onomatopoeic verbs starting with letter ख",
  "Onomatopoeic verbs starting with letter ग",
  "Onomatopoeic verbs starting with letter घ",
  "Onomatopoeic verbs starting with letter च",
  "Onomatopoeic verbs starting with letters छ, ज and झ",
  "Onomatopoeic verbs starting with letters ट, ठ and ड",
  "Onomatopoeic verbs starting with letters त, थ, द, ध and न",
  "Onomatopoeic verbs starting with letter प",
  "Onomatopoeic verbs starting with letter फ",
  "Onomatopoeic verbs starting with letters ब and भ",
  "Onomatopoeic verbs starting with letter म",
  "Onomatopoeic verbs starting with letters य, र and ल",
  "Onomatopoeic verbs starting with letter व",
  "Onomatopoeic verbs starting with letters श, स and ष",
  "Onomatopoeic verbs starting with letter ह",
  "Parts of Speech",
  "Adjectives",
  "Adjectives for action",
  "Adjectives for age",
  "Adjectives for appearance",
  "Adjectives for circumstances",
  "Adjectives for colour",
  "Adjectives for condition of food",
  "Adjectives for condition of nature",
  "Adjectives for condition of objects",
  "Adjectives for condition of person",
  "Adjectives for condition of place",
  "Adjectives for direction",
  "Adjectives for domicile",
  "Adjectives for emotion or feeling",
  "Adjectives for features for nature",
  "Adjectives for features of food",
  "Adjectives for features of objects",
  "Adjectives for general location",
  "Adjectives for location on body",
  "Adjectives for material",
  "Adjectives for opinion, perception, impression",
  "Adjectives for personality",
  "Adjectives for position",
  "Adjectives for purpose",
  "Adjectives for quantity",
  "Adjectives for relation",
  "Adjectives for shapes and patterns",
  "Adjectives for situations",
  "Adjectives for size",
  "Adjectives for smell",
  "Adjectives for sound",
  "Adjectives for speed",
  "Adjectives for taste",
  "Adjectives for temperature",
  "Adjectives for time period",
  "Adjectives for topography",
  "Adjectives for touch",
  "Adjectives for traits",
  "Adjectives for type",
  "Adjectives for weight",
  "Complimentary adjectives",
  "Definite numeral adjectives",
  "Demonstrative adjectives",
  "Indefinite numeral adjectives",
  "Other miscellaneous adjectives",
  "Other miscellaneous adjectives shared with other indian languages",
  "Adverbs",
  "Adverbs of Degree or Quantity",
  "Adverbs of Minimal",
  "Adverbs of Category",
  "Adverbs of Excess",
  "Adverbs of Comparison",
  "Adverbs of Adequate",
  "Adverbs of Manner",
  "Adverbs of Method",
  "Adverbs of Indecisiveness",
  "Adverbs of Decisiveness",
  "Adverbs of Purpose",
  "Adverbs of Negation",
  "Adverbs of Concept",
  "Adverbs of Description",
  "Adverbs of Affirmation",
  "Adverbs of Place",
  "Adverbs of Direction",
  "Adverbs of Position",
  "Adverbs of Time",
  "Adverbs of Time Point",
  "Adverbs of Frequency",
  "Adverbs of Duration",
  "Misc Adverbs",
  "Conjunction",
  "Nouns",
  "Abstract nouns",
  "Collective noun",
  "Common nouns",
  "Community nouns",
  "Countable nouns",
  "Countable nouns for aperture",
  "Mass nouns or uncountable nouns",
  "Nouns based on form",
  "Nouns denoting portion, share etc.",
  "Nouns for punishment",
  "Nouns related to dimension and state",
  "Nouns shared with other indian languages with konkanised spellings",
  "Occupational nouns",
  "Root word",
  "Sensory nouns",
  "Sensory nouns related to sight or appearance",
  "Sensory nouns related to smell",
  "Sensory nouns related to sound",
  "Sensory nouns related to taste",
  "Sensory nouns related to touch",
  "Special trait nouns",
  "Trait noun",
  "Uncountable nouns",
  "Verbal noun",
  "Preposition or Postpositions",
  "Pronouns",
  "Personal Pronouns",
  "Subjective Pronouns",
  "Objective Pronouns",
  "Demonstrative Pronouns",
  "Indefinite Pronouns",
  "Compound Personal Pronoun",
  "Reflexive Pronouns 1",
  "Reflexive Pronouns 2",
  "Intensive Pronouns",
  "Oblique case",
  "Possessive Pronouns",
  "Possessive Pronouns (Absolute 1)",
  "Possessive Pronouns (Absolute 2)",
  "Possessive Pronouns (Adjective 1)",
  "Possessive Pronouns (Adjective 2)",
  "Instrumental case of Pronouns 1",
  "Instrumental case of Pronouns 2",
  "Dative case of Pronouns 1",
  "Dative case of Pronouns 2",
  "Ablative case of Pronouns",
  "Accusative case of Pronouns",
  "Locative case of Pronouns 1",
  "Locative case of Pronouns 2",
  "Declension of Demonstrative Pronouns",
  "Verb",
  "Verbs starting with letter अ",
  "Verbs starting with letter आ",
  "Verbs starting with letters इ,ई and उ",
  "Verbs starting with letter ऊ",
  "Verbs starting with letters ए, ऐ, ओ and औ",
  "Verbs starting with letter क",
  "Verbs starting with letter का",
  "Verbs starting with letters कि and की",
  "Verbs starting with letters कु and कू",
  "Verbs starting with letters के, को and कौ",
  "Verbs starting with letter ख",
  "Verbs starting with letter खा",
  "Verbs starting with letters खि and खी",
  "Verbs starting with letters खु, खू, खे,and खै",
  "Verbs starting with letters खो and खौ",
  "Verbs starting with letter ग",
  "Verbs starting with letter गा",
  "Verbs starting with letters गि, गी, गु and गू",
  "Verbs starting with letters गो and गौ",
  "Verbs starting with letter घ",
  "Verbs starting with letter घा",
  "Verbs starting with letter घु and घू",
  "Verbs starting with letters घे, घै, घो and घौ",
  "Verbs starting with letter च",
  "Verbs starting with letter चा",
  "Verbs starting with letters चि and ची",
  "Verbs starting with letters चु, चू,चे and चै",
  "Verbs starting with letters चो and चौ",
  "Verbs starting with letter छ",
  "Verbs starting with letter ज",
  "Verbs starting with letter जा",
  "Verbs starting with letters जि and जी",
  "Verbs starting with letters जु, जू, जे and जै",
  "Verbs starting with letters जो and जौ",
  "Verbs starting with letters झ and झा",
  "Verbs starting with letters झि, झी, झु, झू, झे, झै, झो and झौ",
  "Verbs starting with letter ट",
  "Verbs starting with letter ड",
  "Verbs starting with letter ढ",
  "Verbs starting with letter त",
  "Verbs starting with letter ता",
  "Verbs starting with letters ति, ती, तु and तू",
  "Verbs starting with letters तृ, ते, तै, तो and तौ",
  "Verbs starting with letter थ",
  "Verbs starting with letters द and दा",
  "Verbs starting with letters दि and दी",
  "Verbs starting with letters दु and दू",
  "Verbs starting with letters दे, दै, दो and दौ",
  "Verbs starting with letters ध and धा",
  "Verbs starting with letters धि,धी,धु and धू",
  "Verbs starting with letters धे, धै, धो and धौ",
  "Verbs starting with letters न and ना",
  "Verbs starting with letter नि",
  "Verbs starting with letter नी",
  "Verbs starting with letters नु, नू, ने, नै, नो and नौ",
  "Verbs starting with letter न्ह",
  "Verbs starting with letter प",
  "Verbs starting with letter पा",
  "Verbs starting with letter पि",
  "Verbs starting with letter पी",
  "Verbs starting with letter पु",
  "Verbs starting with letter पू",
  "Verbs starting with letters पे and पै",
  "Verbs starting with letters पो and पौ",
  "Verbs starting with letter प्र",
  "Verbs starting with letter फ",
  "Verbs starting with letter फा",
  "Verbs starting with letters फि, फी, फु and फू",
  "Verbs starting with letters फे, फै, फो and फौ",
  "Verbs starting with letter ब",
  "Verbs starting with letter बा",
  "Verbs starting with letters बि, बी, बु and बू",
  "Verbs starting with letters बे and बै",
  "Verbs starting with letters बो and बौ",
  "Verbs starting with letters भ and भा",
  "Verbs starting with letters भि and भी",
  "Verbs starting with letters भु and भू",
  "Verbs starting with letters भे, भै, भो and भौ",
  "Verbs starting with letter म",
  "Verbs starting with letter मा",
  "Verbs starting with letters मि and मी",
  "Verbs starting with letters मु and मू",
  "Verbs starting with letters मृ, मे and मै",
  "Verbs starting with letters मो, मौ and म्ह",
  "Verbs starting with letter य",
  "Verbs starting with letter र",
  "Verbs starting with letters रा",
  "Verbs starting with letters रि and री",
  "Verbs starting with letters रु, रू, रे, रै, रो and रौ",
  "Verbs starting with letter ल",
  "Verbs starting with letter ला",
  "Verbs starting with letters लि, ली, ले and लै ",
  "Verbs starting with letters लो, लौ and ल्ह",
  "Verbs starting with letter व",
  "Verbs starting with letter वा",
  "Verbs starting with letters वि and वी",
  "Verbs starting with letters वे and वै",
  "Verbs starting with letters वो and वौ",
  "Verbs starting with letter व्ह",
  "Verbs starting with letters श and शा",
  "Verbs starting with letters शि and शी",
  "Verbs starting with letters शु, शू, शे and शै",
  "Verbs starting with letters शो, शौ, श्र and श्व",
  "Verbs starting with letter स",
  "Verbs starting with letter सा",
  "Verbs starting with letters सि, सी, सु and सू",
  "Verbs starting with letters से, सै, सो and सौ",
  "Verbs starting with letters स्त, स्थ, स्फ and स्व",
  "Verbs starting with letter ह",
  "Verbs starting with letter हा",
  "Verbs starting with letters हि, ही, हु and हू",
  "Verbs starting with letters हे, है, हो and हौ",
  "Singular-plural",
  "Immediate Future",
  "Probable Future tense",
  "Transitional phrases",
  "Transitional words based on Time, Cronology, Sequence",
  "Transitional words based on Cause and Effect",
  "Food",
  "Cooked food",
  "Water and beverages",
  "Sweets",
  "Sweet food items",
  "Ball shaped sweet",
  "Sweet flat bread",
  "Jelly like sweet",
  "Soft flat sweet",
  "Soft rice sweet",
  "Semolina pudding",
  "Sweet batter covered ball",
  "Sweet flat dumpling",
  "Sweet mix",
  "Indian dessert",
  "Sweet pudding with jaggery or sugar",
  "Sweet fruit pudding",
  "Sweet pudding dessert",
  "Sweet pudding",
  "Sweet and savoury dishes",
  "Sweet dishes",
  "Sweet savoury dish of fruits",
  "Sweet fruit dish",
  "Thin sweet dish",
  "Sweet savoury dish with coconut",
  "Sweet savoury dry dish",
  "Deep fried food items",
  "Deep fried snacks",
  "Spicy deep fried fritter of chickpea batter",
  "Deep fried dry snacks",
  "Deep fried chips",
  "Deep fried finger chips",
  "Spicy deep fried fritter of rice flour",
  "Steamed cakes and pancakes",
  "Indian pancake",
  "Steamed cakes",
  "Moist snacks",
  "Variety of cooked rice",
  "Main dishes",
  "Spiced curry used to mix with rice",
  "Weak slightly sour dish with coconut",
  "Major dish",
  "Main curry with curd",
  "Main curry with coconut",
  "Main curry or dish",
  "Main curry or dish with a roasted and ground coconut masala",
  "Sub dishes",
  "Sub curry or dish",
  "Sub dish with coconut",
  "Sub dish with buttermilk",
  "Wet sub dish",
  "Side dish",
  "Coconut based stir fry",
  "Dry sub dish",
  "Salad or cold dish",
  "Cold dish",
  "Hot spicy pickle and stuff",
  "Hot spicy",
  "Fresh sour fruits seasoned",
  "Wet pickle",
  "Dry pickle",
  "Fresh pickle",
  "Squeezed pickle",
  "Pounded and crushed pickle",
  "Fresh pickle with fried vegetables",
  "Spicy hot curry",
  "Cured and dried",
  "Dried and fried items",
  "Dried and deep fried items",
  "Sun dried fritters",
  "Cured, dried and deep fried",
  "Crispy thin cracker dried and deep fried",
  "Culture",
  "Sixteen rites of passage",
  "Marriage",
  "Other words related to wedding",
  "Words related to pre wedding",
  "Customs related to wedding ceremony",
  "Post wedding customs",
  "Eight auspicious items",
  "Gifts given to the groom",
  "Upanayanam or sacred thread ceremony",
  "words related to upanayanam",
  "Verbs related to upanayanam",
  "Other minor rites",
  "Death ceremony",
  "Other rituals and poojas",
  "Rangoli at tulasi",
  "Decorative or sacred mark",
  "Festivals",
  "Festivals celebrated at home",
  "Festivals celebrated at temples",
  "Rituals and poojas related to Navaratri;",
  "Other celebrations",
  "Community festivals",
  "Special food items made at homes on festival days",
  "Verbs related to customs and rituals",
  "Lengthy periods of worship",
  "Temple",
  "Words related to temple",
  "Verbs related to temple",
  "Parts of a temple",
  "Items used in temple",
  "Nivedhyams in temple",
  "Annual temple festival",
  "Relation",
  "Gotras",
  "Relationship",
  "Other nouns for relation",
  "Time and space",
  "Astrology and astronomy",
  "Nine planets of astrology",
  "Nine planets of solar system",
  "Corresponding western zodiac for hindu astrological stars",
  "Other words related to astrology",
  "Days of a week",
  "Fortnight",
  "Bright lunar fortnight or period of waxing moon",
  "Dark lunar fortnight or period of waning moon",
  "Months",
  "Time and Period",
  "Seasons",
  "Time",
  "Time and Period",
  "Words related to time and day",
  "Numbers and measurements",
  "Numbers",
  "Cardinal numbers",
  "Ordinal numbers, Numerical adjectives",
  "Measurements",
  "Length measured using body parts",
  "Width measured using hand",
  "Weight of gold measured using objects",
  "Depth measured using body parts",
  "Measure of quantity",
  "Quantity measured using hands",
  "Measures of volume for grains or liquid",
  "Measures adapted from Malayalam for grains",
  "Other words related to measurements",
  "Other general vocabulary",
  "Agriculture",
  "Nouns relating to agriculture",
  "Verbs related to agriculture",
  "Capital and accounts",
  "Colours",
  "Main colours",
  "Other colours",
  "Directions",
  "Edges and points",
  "Fireworks, pyrotechnics",
  "Flower strings",
  "Habitat",
  "Kings and kingdoms",
  "Languages",
  "Medicine",
  "Minerals",
  "Musical instruments",
  "Nature",
  "Paths and lanes",
  "Vehicles and parts",
  "Words related to games",
  "Extra vocabulary",
];

app.get("/discover", async function (req, res, next) {
  try {
    const randomCategory =
      contentList[Math.floor(Math.random() * contentList.length)];

    // const randomQuery = new azure.TableQuery()
    //   .select(["PartitionKey", "RowKey"])
    //   .where("english_subcategory eq ?", randomCategory);
    const randomQuery = {
      select: ["PartitionKey", "RowKey"],
      filter: `english_subcategory eq '${randomCategory}'`,
    };

    const result = await queryEntities("dictkontoeng", randomQuery);

    if (result.length > 0) {
      const selectedEntry = result[Math.floor(Math.random() * result.length)];
      if (!selectedEntry.hasOwnProperty("partitionKey")) {
        rollbar.error(
          "Selected random entry, but entry did not have PartitionKey",
          { entry: selectedEntry, category: randomCategory },
          req
        );
        res.redirect("/");
      } else {
        const entity = await retrieveEntity(
          "dictkontoeng",
          selectedEntry["partitionKey"],
          selectedEntry["rowKey"]
        );

        console.info("Fetching", entity["konkani_word"]);
        res.redirect("/words/" + entity["konkani_word"]);
      }
    } else {
      rollbar.warn(
        "Possibly picked an empty category for discover",
        { subcategory: randomCategory },
        req
      );
      res.redirect("/discover");
    }
  } catch (error) {
    rollbar.error(
      "Could not execute randomQuery",
      error,
      { random_query: randomQuery },
      req
    );
    res.redirect("/");
  }
});

app.get("/category/:category", async function (req, res, next) {
  try {
    const category = req.params.category.replace(/\+/g, " ");

    let primary_column,
      secondary_column,
      primary_table,
      secondary_table,
      primary_subcategory,
      secondary_subcategory;
    if (/^([\x00-\xFF]+)/.test(category)) {
      primary_column = "english_word";
      secondary_column = "konkani_word";
      primary_table = config.db1;
      secondary_table = config.db2;
      primary_subcategory = "english_subcategory";
      secondary_subcategory = "konkani_subcategory";
    } else {
      primary_column = "konkani_word";
      secondary_column = "english_word";
      primary_table = config.db2;
      secondary_table = config.db1;
      primary_subcategory = "konkani_subcategory";
      secondary_subcategory = "english_subcategory";
    }

    // TODO: Update browse_count

    // TODO: Related words, same subcategory words

    const samesubcat_query = {
      select: [
        primary_column,
        secondary_subcategory,
        primary_subcategory,
        "weight",
      ],
      filter: `${primary_subcategory} eq '${category}'`,
    };

    const result = await queryEntities(primary_table, samesubcat_query);

    let samesubcat_entries = [];
    if (result.length > 0) {
      result.forEach(function (row) {
        if (!row.hasOwnProperty(primary_column)) {
          rollbar.error(
            "unique_entries_by_column() failed 1",
            { result_entries: result, primary_column: primary_column },
            req
          );
        }
      });
      samesubcat_entries = unique_entries_by_column(
        req,
        result,
        primary_column
      );
      samesubcat_entries = sort_entries_by_column(samesubcat_entries, "weight");
      // TODO: Sort words by konkani
    }

    res.render("subcategory", {
      title: "A Southern Konkani Vocabulary Collection - दक्षिण कोंकणी उतरावळि",
      heading: "A Southern Konkani Vocabulary Collection",
      heading_konkani: "दक्षिण कोंकणी उतरावळि",
      same_subcat_words: samesubcat_entries,
    });
  } catch (error) {
    rollbar.error(
      "Error occurred when running samesubcat_query",
      error,
      { param: category },
      req
    );
    next(error);
  }
});

app.get("*", function (req, res) {
  rollbar.warning("A user tried to access an unavailable URL", req);
  res.redirect("/");
});

// Use the rollbar error handler to send exceptions to your rollbar account
app.use(rollbar.errorHandler());

app.listen(app.get("port"), app.get("ipaddress"), function () {
  console.log(
    "App is running, server is listening on host:port ",
    app.get("ipaddress"),
    ":",
    app.get("port")
  );
});
