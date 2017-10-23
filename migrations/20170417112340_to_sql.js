/*eslint-env node*/
'use strict';

exports.up = function(knex, Promise) {
  //const tableName = this.config.emberCliDeploy.tableName;
  const tableName = global.TABLE_NAME;

  return knex.schema.hasColumn(tableName, 'is_active').then((exists) => {
    // Backwards compatibility with earlier versions of ember-cli-deploy-sql,
    // which required a manual migration.
    if (exists) {
      return Promise.resolve();
    }

    return knex.schema.alterTable(tableName, (tbl) => {
      tbl.string('description').after('deployer');
      tbl.boolean('is_active').after('description').notNullable().defaultTo(false).index();
    }).then(() =>
        knex(tableName)
          .first()
          .pluck('value')
          .where('key', 'current')
          .reduce((_, key) => key, null))
      .then(current => current && knex(tableName).where('key', current).update('is_active', true))
      .then(() => knex(tableName).where('key', 'current').delete());
  });
};

exports.down = function(knex) {
  //const tableName = this.config.emberCliDeploy.tableName;
  const tableName = global.TABLE_NAME;

  return knex(tableName)
    .first()
    .pluck('key')
    .where('is_active', true)
    .reduce((_, key) => key, null)
    .then(current => current && knex(tableName).insert({ key: 'current', value: current }))
    .then(() => knex.schema.alterTable(tableName, (tbl) => {
      tbl.dropColumn('description');
      tbl.dropColumn('is_active');
    }));
};
