'use strict';
var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');

let databaseOptions = {
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { maxConnections: 10, minConnections: 1 },
  host: process.env.POSTGRESQL_HOST,
  port: process.env.POSTGRESQL_PORT	
};

if (process.env.SSL_DATABASE) {
  databaseOptions.dialectOptions = { ssl: true };
}

let sequelize = new Sequelize(process.env.POSTGRESQL_DB, process.env.POSTGRESQL_USER, process.env.POSTGRESQL_PASSWORD, databaseOptions);
let db = {};

fs
  .readdirSync(__dirname)
  .filter(function (file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function (file) {
    try {
      var model = sequelize['import'](path.join(__dirname, file));
      db[model.name] = model;
    } catch (error) {
      console.error('Model creation error: ' + error);
    }
  });

Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

