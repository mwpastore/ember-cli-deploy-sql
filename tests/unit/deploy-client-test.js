/*global Uint8Array*/
/*eslint-env node, mocha*/
'use strict';

const assert = require('../helpers/assert');
const rewire = require('rewire');
const subject = rewire('../../lib/deploy-client');

describe('DeployClient private methods', function() {
  const knex = require('knex')({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    //debug: true
  });

  beforeEach(() => {
    global.TABLE_NAME = 'test';

    return knex.migrate.latest();
  });

  afterEach(() => {
    global.TABLE_NAME = 'test';

    return knex.migrate.rollback();
  });

  // Tear down the connection pool after all the tests have completed.
  after(() => knex.destroy());

  describe('#createTable()', function() {
    it('sets appropriate column defaults', function() {
      return knex('test').insert({ key: 'foo', value: 'bar' })
        .then(() => knex('test').first())
        .then((row) => {
          assert.isObject(row);
          assert.propertyVal(row, 'key', 'foo');
          assert.propertyVal(row, 'value', 'bar');
          assert.isNull(row.gitsha);
          assert.isNull(row.deployer);
          assert.isNull(row.description);
          assert.isNotOk(row.is_active);
          assert.approximately(
            Date.parse(row.created_at.replace(' ', 'Z')),
            Date.now(),
            1000
          );
        });
    });
  });

  describe('#conditionallyCreateRevision()', function() {
    const createRevision = subject.__get__('conditionallyCreateRevision');

    it('creates a revision if none exists', function() {
      return createRevision.call({ knex }, 'test', 'foo', 'bar')
        .then(() => knex('test').select('key', 'value'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 1);

          const revision = revisions[0];

          assert.isObject(revision);
          assert.propertyVal(revision, 'key', 'foo');
          assert.propertyVal(revision, 'value', 'bar');
        });
    });

    it('will not overwrite an existing revision by default', function() {
      return knex('test').insert({ key: 'foo', value: 'bar' })
        .then(() => {
          let promise = createRevision.call({ knex }, 'test', 'foo', 'qux');

          return assert.isRejected(promise);
        });
    });

    it('may be configured to overwrite an existing revision', function() {
      return knex('test').insert({ key: 'foo', value: 'bar' })
        .then(() => createRevision.call({ knex, allowOverwrite: true }, 'test', 'foo', 'qux'))
        .then(() => knex('test').select('key', 'value'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 1);

          const revision = revisions[0];

          assert.isObject(revision);
          assert.propertyVal(revision, 'key', 'foo');
          assert.propertyVal(revision, 'value', 'qux');
        });
    });
  });

  describe('#listRevisions()', function() {
    const listRevisions = subject.__get__('listRevisions');

    it('resolves to an empty array if none', function() {
      return listRevisions.call({ knex }, 'test')
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 0);
        });
    });

    it('orders the results in reverse chronological order', function() {
      return knex('test').insert([
        { key: 'first', value: 'foo', created_at: 1 },
        { key: 'second', value: 'bar', created_at: 2 }
      ]).then(() => listRevisions.call({ knex }, 'test'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 2);

          const first = revisions[1];
          const second = revisions[0];

          assert.isObject(first);
          assert.propertyVal(first, 'revision', 'first');

          assert.isObject(second);
          assert.propertyVal(second, 'revision', 'second');
        });
    });

    it('maps the fields to those expected by ember-cli-deploy', function() {
      const gitsha = '0be6deba468d1190fae91b96d16bfa02233004bd';
      const bytes = [];
      for (let i = 0; i < gitsha.length; i += 2) {
        bytes.push(parseInt(gitsha.substr(i, 2), 16));
      }

      return knex('test').insert({
        key: 'foo',
        value: 'bar',
        gitsha: new Uint8Array(bytes),
        deployer: 'tester magee',
        description: 'this is a test',
        is_active: true
      }).then(() => listRevisions.call({ knex }, 'test'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 1);

          const revision = revisions[0];

          assert.isObject(revision);
          assert.propertyVal(revision, 'revision', 'foo');
          assert.propertyVal(revision, 'version', gitsha);
          assert.propertyVal(revision, 'deployer', 'tester magee');
          assert.propertyVal(revision, 'description', 'this is a test');
          assert.property(revision, 'timestamp');
          assert.isOk(revision.active);
        });
    });
  });

  describe('#trimRevisions()', function() {
    const trimRevisions = subject.__get__('trimRevisions');

    it('preserves the most recent N revisions', function() {
      const revisionList = [
        { key: 'third', value: 'qux', created_at: 3 },
        { key: 'second', value: 'bar', created_at: 2 },
        { key: 'first', value: 'foo', created_at: 1 }
      ];

      const revisionKeys = revisionList.map(revision => ({
        revision: revision.key
      }));

      return knex('test').insert(revisionList)
        .then(() => trimRevisions.call({ knex, maxRecentUploads: 2 }, 'test', revisionKeys))
        .then(() => knex('test').select('key').orderBy('created_at'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 2);

          let second = revisions[0];
          let third = revisions[1];

          assert.isObject(second);
          assert.propertyVal(second, 'key', 'second');

          assert.isObject(third);
          assert.propertyVal(third, 'key', 'third');
        });
    });

    it('will preserve the active revision', function() {
      const revisionList = [
        { key: 'third', value: 'qux', created_at: 3, is_active: false },
        { key: 'second', value: 'bar', created_at: 2, is_active: false },
        { key: 'first', value: 'foo', created_at: 1, is_active: true }
      ];

      const revisionKeys = revisionList.map(revision => ({
        revision: revision.key,
        active: revision.is_active
      }));

      return knex('test').insert(revisionList)
        .then(() => trimRevisions.call({ knex, maxRecentUploads: 2 }, 'test', revisionKeys))
        .then(() => knex('test').select('key').orderBy('created_at'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 3);
        });
    });

    it('does not choke with fewer than max revisions', function() {
      const revisionList = [
        { key: 'first', value: 'foo', created_at: 1 },
        { key: 'second', value: 'bar', created_at: 2 },
        { key: 'third', value: 'qux', created_at: 3 }
      ];

      const revisionKeys = revisionList.map(revision => ({
        revision: revision.key
      }));

      return knex('test').insert(revisionList)
        .then(() => trimRevisions.call({ knex, maxRecentUploads: 3 }, 'test', revisionKeys))
        .then(() => knex('test').select('key').orderBy('created_at'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 3);
        });
    });

    it('does not choke on an empty revisions list', function() {
      return trimRevisions.call({ knex, maxRecentUploads: 10 }, 'test', []);
    });
  });

  describe('#doesRevisionExist()', function() {
    const doesRevisionExist = subject.__get__('doesRevisionExist');

    it('returns a falsy value if a revision does not exist', function() {
      return doesRevisionExist.call({ knex }, 'test', 'foo')
        .then(assert.isNotOk.bind(null));
    });

    it('returns a truthy value if a revision does exist', function() {
      return knex('test').insert({ key: 'bar', value: 'foo' })
        .then(() => doesRevisionExist.call({ knex }, 'test', 'bar'))
        .then(assert.isOk.bind(null));
    });
  });

  describe('#validateRevision()', function() {
    const validateRevision = subject.__get__('validateRevision');

    it('rejects a revision if it does not exist', function() {
      let promise = validateRevision.call({ knex }, 'test', 'foo');

      return assert.isRejected(promise);
    });

    it('returns the key of an existing revision', function() {
      return knex('test').insert({ key: 'bar', value: 'foo' })
        .then(() => validateRevision.call({ knex }, 'test', 'bar'))
        .then(assert.strictEqual.bind(null, 'bar'));
    });
  });

  describe('#activateRevision()', function() {
    const activateRevision = subject.__get__('activateRevision');

    it('activates one revision and deactivates the others', function() {
      const revisionList = [
        { key: 'first', value: 'foo', is_active: false },
        { key: 'second', value: 'bar', is_active: true },
        { key: 'third', value: 'qux', is_active: false }
      ];

      function hashify(key, arr) {
        return arr.reduce(function(memo, obj) {
          memo[obj[key]] = obj;
          return memo;
        }, Object.create(null));
      }

      return knex('test').insert(revisionList)
        .then(() => activateRevision.call({ knex }, 'test', 'third'))
        .then(() => hashify('key', knex('test').select('key', 'is_active')))
        .then((lookup) => {
          assert.isNotOk(lookup.first.is_active);
          assert.isNotOk(lookup.second.is_active);
          assert.isOk(lookup.third.is_active);
        });
    });
  });
});

describe('DeployClient constructor', function() {
  it('accepts allowOverwrite and maxRecentUploads options', function() {
    let deployClient = new subject({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      maxRecentUploads: '11',
      allowOverwrite: 'yes'
    });

    assert.property(deployClient, 'maxRecentUploads');
    assert.isNumber(deployClient.maxRecentUploads);

    assert.property(deployClient, 'allowOverwrite');
    assert.isBoolean(deployClient.allowOverwrite);

    assert.property(deployClient, 'knex');

    deployClient.destroy();
  });
});

describe('DeployClient public API', function() {
  const baseOptions = {
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    options: {
      useNullAsDefault: true,
      //debug: true
    },
    maxRecentUploads: 10,
    allowOverwrite: false
  };

  let deployClient;

  afterEach(() => {
    if (deployClient) {
      deployClient.destroy();
      deployClient = undefined;
    }
  });

  describe('#sanityCheck()', function() {
    it('creates a table if none exists', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.knex('foo').columnInfo())
        .then((info) => {
          assert.isObject(info);

          assert.deepPropertyVal(info, 'id.type', 'integer');
          assert.deepPropertyVal(info, 'key.type', 'varchar');
          assert.deepPropertyVal(info, 'value.type', 'text');
          assert.deepPropertyVal(info, 'is_active.type', 'boolean');
          assert.deepPropertyVal(info, 'created_at.type', 'datetime');
        });
    });

    it('does not create a table if one exists', function() {
      deployClient = new subject(baseOptions);

      return deployClient.knex.schema.createTable('bar', (tbl) => {
        tbl.increments();
        tbl.string('key').notNullable().unique();
        tbl.boolean('is_active').notNullable().default(false);
        tbl.timestamps();
      }).then(() => deployClient.sanityCheck({ tableName: 'bar' }))
        .then(() => deployClient.knex('bar').columnInfo())
        .then((info) => {
          assert.isObject(info);

          assert.deepPropertyVal(info, 'id.type', 'integer');
          assert.deepPropertyVal(info, 'key.type', 'varchar');
          assert.deepPropertyVal(info, 'is_active.type', 'boolean');
          assert.deepPropertyVal(info, 'created_at.type', 'datetime');
          assert.deepPropertyVal(info, 'updated_at.type', 'datetime');

          assert.notProperty(info, 'value');
          assert.notProperty(info, 'description');
        });
    });
  });

  describe('#fetchRevisions()', function() {
    it('returns successfully', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.fetchRevisions({ tableName: 'foo' }));
    });
  });

  describe('#activeRevisionKey()', function() {
    it('returns the active revision key', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.knex('foo').insert([
          { key: 'first', value: 'foo', is_active: false },
          { key: 'second', value: 'bar', is_active: true },
          { key: 'third', value: 'qux', is_active: false }
        ]))
        .then(() => deployClient.activeRevisionKey({ tableName: 'foo' }))
        .then((key) => {
          assert.strictEqual(key, 'second');
        });
    });

    it('returns null if no revision keys are active', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.knex('foo').insert({ key: 'foo', value: 'bar' }))
        .then(() => deployClient.activeRevisionKey({ tableName: 'foo' }))
        .then((key) => {
          assert.isNull(key);
        });
    });
  });

  describe('#activateRevision()', function() {
    it('activates a valid revision', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.knex('foo').insert({ key: 'foo', value: 'bar' }))
        .then(() => deployClient.activateRevision({ tableName: 'foo', revisionKey: 'foo' }))
        .then(() => deployClient.knex('foo').select('key').where('is_active', true))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 1);

          const revision = revisions[0];

          assert.isObject(revision);
          assert.propertyVal(revision, 'key', 'foo');
        });
    });

    it('will not activate an invalid revision', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => {
          let promise = deployClient.activateRevision({ tableName: 'foo', revisionKey: 'foo' });

          return assert.isRejected(promise);
        });
    });
  });

  describe('#upload()', function() {
    it('uploads a new revision with a payload', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.upload({ tableName: 'foo', value: 'bar' }))
        .then(() => deployClient.knex('foo').select('key', 'value'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 1);

          const revision = revisions[0];

          assert.isObject(revision);
          assert.propertyVal(revision, 'key', 'default');
          assert.propertyVal(revision, 'value', 'bar');
        });
    });

    it('returns the table name and revision key', function() {
      deployClient = new subject(baseOptions);

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.upload({ tableName: 'foo', value: 'bar' }))
        .then((result) => {
          assert.propertyVal(result, 'tableName', 'foo');
          assert.propertyVal(result, 'revisionKey', 'default');
        });
    });

    it('keeps things tidy', function() {
      deployClient = new subject(Object.assign({}, baseOptions, {
        maxRecentUploads: 2
      }));

      let revisionList = [
        { key: 'first', value: 'foo', created_at: 1 },
        { key: 'second', value: 'bar', created_at: 2 },
        { key: 'third', value: 'qux', created_at: 3 }
      ];

      return deployClient.sanityCheck({ tableName: 'foo' })
        .then(() => deployClient.knex('foo').insert(revisionList))
        .then(() => deployClient.upload({ tableName: 'foo', revisionKey: 'fourth', value: 'wat' }))
        .then(() => deployClient.knex('foo').select('key', 'value').orderBy('created_at'))
        .then((revisions) => {
          assert.isArray(revisions);
          assert.lengthOf(revisions, 2);

          const third = revisions[0];
          const fourth = revisions[1];

          assert.isObject(third);
          assert.propertyVal(third, 'key', 'third');
          assert.propertyVal(third, 'value', 'qux');

          assert.isObject(fourth);
          assert.propertyVal(fourth, 'key', 'fourth');
          assert.propertyVal(fourth, 'value', 'wat');
        });
    });
  });
});
