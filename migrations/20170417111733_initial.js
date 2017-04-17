/*eslint-env node*/
'use strict';

exports.up = function(knex, Promise) {
  //const tableName = this.config.emberCliDeploy.tableName;
  const tableName = global.TABLE_NAME;

  return knex.schema.hasTable(tableName).then(exists => {
    // Backwards compatibility with ember-cli-deploy-mysql and -postgres, which
    // implemented a static table creation.
    if (exists) {
      return Promise.resolve();
    }

    return knex.schema.createTable(tableName, tbl => {
      tbl.increments();
      tbl.string('key').notNullable().unique();
      tbl.text('value').notNullable();
      tbl.binary('gitsha', 20);
      tbl.string('deployer');
      tbl.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
  });
};

exports.down = function(knex) {
  //const tableName = this.config.emberCliDeploy.tableName;
  const tableName = global.TABLE_NAME;

  return knex.schema.dropTable(tableName);
};
