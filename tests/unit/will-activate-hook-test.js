/*global Promise*/
/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');

describe('DeployPlugin | willActivate hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  it('fetches the activated revision', function() {
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
            activeRevisionKey() {
              return Promise.resolve('123abc');
            }
          }),
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    return instance.willActivate(context)
      .then(result => {
        assert.deepPropertyVal(result, 'revisionData.previousRevisionKey', '123abc');
      });
  });

  it('rejects if an error is thrown while fetching', function() {
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
            activeRevisionKey() {
              return Promise.reject('some-error');
            }
          }),
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    let promise = instance.willActivate(context);

    return assert.isRejected(promise)
      .then(() => {
        assert.include(mockUi.messages.pop(), 'some-error');
      });
  });
});
