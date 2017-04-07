/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');

describe('DeployPlugin | configure hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  beforeEach(function() {
    mockUi.messages.length = 0;
  });

  describe('required config', function() {
    it('warns about missing config props', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        config: {
          sql: {}
        }
      };

      instance.beforeHook(context);

      assert.throws(function() {
        instance.configure(context);
      });

      // Only the first not-found config prop will raise an error.
      assert.include(mockUi.messages.pop(), 'Missing required config: `client`');
    });
  });

  describe('default config', function() {
    it('provides reasonable defaults', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        distDir: '/tmp',
        project: {
          name: function() {
            return 'foo-bar';
          }
        },
        config: {
          sql: {
            client: 'sqlite3'
          }
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      assert.strictEqual(instance.readConfig('allowOverwrite'), false);
      assert.strictEqual(instance.readConfig('maxRecentUploads'), 10);
      assert.deepEqual(instance.readConfig('connection'), {});
      assert.deepEqual(instance.readConfig('sqlOptions'), {});
      assert.strictEqual(instance.readConfig('filePattern'), 'index.html');
      assert.strictEqual(instance.readConfig('tableName'), 'foo_bar_bootstrap');
    });
  });

  describe('optional config', function() {
    function helper(key, val) {
      return function() {
        const instance = subject.createDeployPlugin({
          name: 'sql'
        });

        const context = {
          ui: mockUi,
          config: {
            sql: {
              client: 'sqlite3'
            }
          }
        };

        context.config.sql[key] = val;

        instance.beforeHook(context);
        instance.configure(context);

        assert.strictEqual(instance.readConfig(key), val);
      };
    }

    it('takes a filePattern option', helper('filePattern', 'foo.xml'));
    it('takes a distDir option', helper('distDir', '/tmp'));
    it('takes a tableName option', helper('tableName', 'barIdx'));
    it('takes an allowOverwrite option', helper('allowOverwrite', true));
    it('takes a maxRecentUploads option', helper('maxRecentUploads', 33));
    it('takes sqlOptions', helper('sqlOptions', { useNullAsDefault: true }));
  });

  describe('resolving port from the pipeline', function() {
    it('will use a tunnel if available', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        tunnel: {
          srcPort: 12345
        },
        config: {
          sql: {
            client: 'sqlite3',
            sqlOptions: {
              useNullAsDefault: true
            }
          }
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      const deployClient = instance.readConfig('deployClient');

      assert.isObject(deployClient);
      assert.deepPropertyVal(deployClient, 'knex.client.connectionSettings.host', 'localhost');
      assert.deepPropertyVal(deployClient, 'knex.client.connectionSettings.port', 12345);

      instance.teardown(context);
    });

    it('will not use a tunnel if host/port given', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        tunnel: {
          srcPort: 12345
        },
        config: {
          sql: {
            client: 'sqlite3',
            connection: {
              host: 'example.com',
              port: 67890
            },
            sqlOptions: {
              useNullAsDefault: true
            }
          }
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      const deployClient = instance.readConfig('deployClient');

      assert.isObject(deployClient);
      assert.deepPropertyVal(deployClient, 'knex.client.connectionSettings.host', 'example.com');
      assert.deepPropertyVal(deployClient, 'knex.client.connectionSettings.port', 67890);

      instance.teardown(context);
    });

    it('will not use a tunnel if socket given', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        tunnel: {
          srcPort: 12345
        },
        config: {
          sql: {
            client: 'sqlite3',
            connection: {
              socketPath: '/run/sqlite3.sock'
            },
            sqlOptions: {
              useNullAsDefault: true
            }
          }
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      const deployClient = instance.readConfig('deployClient');

      assert.isObject(deployClient);
      assert.notDeepProperty(deployClient, 'knex.client.connectionSettings.host');
      assert.notDeepProperty(deployClient, 'knex.client.connectionSettings.port');

      instance.teardown(context);
    });
  });

  describe('resolving revisionKey from the pipeline', function() {
    it('prefers the config prop over all others', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        config: {
          sql: {
            client: 'sqlite3',
            revisionKey: '12345'
          }
        },
        commandOptions: {
          revision: '55555'
        },
        revisionData: {
          revisionKey: '67890'
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      assert.equal(instance.readConfig('revisionKey'), '12345');
    });

    it('prefers the command-line option over the context', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        config: {
          sql: {
            client: 'sqlite3'
          }
        },
        commandOptions: {
          revision: '55555'
        },
        revisionData: {
          revisionKey: '67890'
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      assert.equal(instance.readConfig('revisionKey'), '55555');
    });

    it('falls back to the context if all else fails', function() {
      const instance = subject.createDeployPlugin({
        name: 'sql'
      });

      const context = {
        ui: mockUi,
        config: {
          sql: {
            client: 'sqlite3'
          }
        },
        revisionData: {
          revisionKey: '67890'
        }
      };

      instance.beforeHook(context);
      instance.configure(context);

      assert.equal(instance.readConfig('revisionKey'), '67890');
    });
  });
});
