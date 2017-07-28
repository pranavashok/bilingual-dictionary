'use strict';

module.exports = (sequelize, DataTypes) => {
  let models = sequelize.models;

  var Model = sequelize.define('wordlist', {
    konkani_word: {
      type: DataTypes.STRING,
    },
    english_word: {
      type: DataTypes.STRING,
    },
    part_of_speech: {
      type: DataTypes.STRING,
    },
    subcategory: {
      type: DataTypes.STRING,
    },
    more_details: {
      type: DataTypes.STRING,
    },
    browse_count: {
      type: DataTypes.INTEGER,
    },
  }, {
    classMethods: {
      associate: () => {
      }
    },
    tableName: 'wordlist',
    underscored: true,
    timestamps: false,
    schema: process.env.DATABASE_SCHEMA,
  });

  return Model;
};

