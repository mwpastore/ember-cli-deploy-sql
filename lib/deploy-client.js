/*eslint-env node*/
'use strict';

const
  CoreObject = require('core-object'),
  Knex = require('knex'),
  Promise = require('bluebird'); // Knex uses Bluebird, so we will too.

//
// Private functions
//
function listRevisions(tableName) {
  return this.knex(tableName)
    .orderBy('created_at', 'desc')
    .select('key', 'gitsha', 'deployer', 'description', 'is_active', 'created_at')
    .map((row) => {
      row.revision = row.key;
      delete row.key;

      if (row.gitsha) {
        row.version = row.gitsha.reduce((memo, b) =>
          memo + (b < 16 ? '0' : '') + b.toString(16), '');
      }
      delete row.gitsha;

      row.active = !!row.is_active;
      delete row.is_active;

      row.timestamp = row.created_at;
      delete row.created_at;

      return row;
    });
}

function trimRevisions(tableName, revisions) {
  const oldKeys = revisions
    .filter(revision => !revision.active)
    .slice(this.maxRecentUploads)
    .map(revision => revision.revision);

  return this.knex(tableName)
    .whereIn('key', oldKeys)
    .delete();
}

function doesRevisionExist(tableName, revisionKey) {
  return this.knex(tableName)
    .where('key', revisionKey)
    .pluck('key')
    .then(keys => keys.length == 1);
}

function conditionallyCreateRevision(tableName, revisionKey, value) {
  return doesRevisionExist.call(this, tableName, revisionKey)
    .then((exists) => {
      if (exists && !this.allowOverwrite) {
        return Promise.reject(`Revision \`${revisionKey}' already exists in \`${tableName}'`);
      }

      // TODO: is there a better way to do a portable upsert?
      return this.knex.transaction(trx => trx
        .from(tableName)
        .where('key', revisionKey)
        .delete()
        .then(() => trx
          .into(tableName)
          // TODO: gitsha, deployer, and description
          // gitsha logic can be found in the #listRevisions() unit test
          .insert({ key: revisionKey, value })));
    });
}

function validateRevision(tableName, revisionKey) {
  return doesRevisionExist.call(this, tableName, revisionKey)
    .then((keyExists) => {
      if (keyExists) {
        return revisionKey;
      }

      return Promise.reject(`\`${revisionKey}' is not a valid revision key`);
    });
}

function activateRevision(tableName, revisionKey) {
  return this.knex(tableName)
    .update('is_active', this.knex.raw('(?? = ?)', ['key', revisionKey]));
}

//
// Public API
//
module.exports = CoreObject.extend({
  allowOverwrite: null,
  maxRecentUploads: null,
  knex: null,

  init(args) {
    // TODO: replace lets with destructured args
    let
      allowOverwrite = args.allowOverwrite,
      maxRecentUploads = args.maxRecentUploads,
      knex = args.knex,
      client = args.client,
      connection = args.connection,
      migrations = args.migrations,
      options = args.options;

    this._super();

    this.allowOverwrite = !!allowOverwrite;
    this.maxRecentUploads = Number(maxRecentUploads);
    this.knex = knex || Knex(Object.assign({}, options || {}, {
      client,
      connection,
      migrations
    }));
  },

  destroy() {
    this.knex.destroy();
  },

  sanityCheck(args) {
    // TODO: replace let with destructured args
    let tableName = args.tableName;

    global.TABLE_NAME = tableName; // FIXME
    return this.knex.migrate.latest();
  },

  upload(args) {
    // TODO: replace lets with destructured args
    let
      tableName = args.tableName,
      revisionKey = args.revisionKey,
      value = args.value;

    revisionKey = revisionKey || 'default';

    return conditionallyCreateRevision.call(this, tableName, revisionKey, value)
      .then(() => listRevisions.call(this, tableName))
      .then(trimRevisions.bind(this, tableName))
      .return({ tableName, revisionKey });
  },

  activateRevision(args) {
    // TODO: replace lets with destructured args
    let
      tableName = args.tableName,
      revisionKey = args.revisionKey;

    revisionKey = revisionKey || 'default';

    return validateRevision.call(this, tableName, revisionKey)
      .then(activateRevision.bind(this, tableName))
      .return({ tableName, revisionKey });
  },

  activeRevisionKey(args) {
    // TODO: replace let with destructured args
    let tableName = args.tableName;

    return this.knex(tableName)
      .where('is_active', true)
      .first()
      .pluck('key')
      .reduce((_, key) => key, null);
  },

  fetchRevisions(args) {
    // TODO: replace let with destructured args
    let tableName = args.tableName;

    return listRevisions.call(this, tableName);
  }
});
