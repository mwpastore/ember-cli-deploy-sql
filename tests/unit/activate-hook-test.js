/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');
const Bluebird = require('bluebird');

describe('DeployPlugin | activate hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  it('activates the revision', function() {
    const instance = subject.createDeployPlugin({
      name: 'sql'
    });

    let didActivate = false;

    const context = {
      ui: mockUi,
      distDir: 'tests',
      config: {
        sql: {
          client: 'mock',
          deployClient: () => ({
            activateRevision() {
              didActivate = true;

              return Bluebird.resolve({
                revisionKey: '123abc'
              });
            }
          }),
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    return instance.activate(context)
      .then((result) => {
        assert.deepPropertyVal(result, 'revisionData.activatedRevisionKey', '123abc');

        assert.ok(didActivate);
      });
  });

  it('rejects if an error is thrown while activating', function() {
    const instance = subject.createDeployPlugin({
      name: 'sql'
    });

    const context = {
      ui: mockUi,
      distDir: 'tests',
      config: {
        sql: {
          client: 'mock',
          deployClient: () => ({
            activateRevision() {
              return Bluebird.reject('some-error');
            }
          }),
          revisionKey: '123abc',
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    let promise = instance.activate(context);

    return assert.isRejected(promise)
      .then(() => {
        assert.include(mockUi.messages.pop(), 'some-error');
      });
  });
});
