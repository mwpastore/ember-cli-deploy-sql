/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');
const Bluebird = require('bluebird');

describe('DeployPlugin | setup hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  let sanityCheckCalled;

  const mockClient = () => ({
    sanityCheck(args) {
      // TODO: replace let with destructured args
      let tableName = args.tableName;

      sanityCheckCalled = true;

      return Bluebird.resolve(tableName);
    }
  });

  it('calls sanityCheck', function() {
    const instance = subject.createDeployPlugin({
      name: 'sql'
    });

    const context = {
      ui: mockUi,
      distDir: 'tests',
      config: {
        sql: {
          client: 'mock',
          deployClient: mockClient,
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    return instance.setup(context)
      .then((result) => {
        assert.ok(sanityCheckCalled);
        assert.equal(result, 'foo');
      });
  });
});
