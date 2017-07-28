'use strict';

module.exports = (sequelize, DataTypes) => {
  let models = sequelize.models;

  var Model = sequelize.define('searchlog', {
    word: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.DATE,
    },
    ipaddress: {
      type: DataTypes.STRING,
    },
  }, {
    classMethods: {
      associate: () => {
      }
    },
    tableName: 'searchlog',
    
    timestamps: false,
    schema: process.env.DATABASE_SCHEMA,
  });

  return Model;
};

