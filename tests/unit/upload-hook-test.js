/*global Promise*/
/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');

describe('DeployPlugin | upload hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  let capturedValue;

  const mockClient = () => ({
    upload(_ref) {
      let
        tableName = _ref.tableName,
        revisionKey = _ref.revisionKey,
        value = _ref.value;

      capturedValue = value;

      return Promise.resolve({
        tableName,
        revisionKey
      });
    }
  });

  it('uploads the index', function() {
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
          revisionKey: '123abc',
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    return instance.upload(context)
      .then(result => {
        assert.propertyVal(result, 'tableName', 'foo');
        assert.propertyVal(result, 'revisionKey', '123abc');

        assert.equal(capturedValue, "<!DOCTYPE html>\n");
      });
  });
});
