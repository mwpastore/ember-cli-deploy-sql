/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');
const Bluebird = require('bluebird');

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
    upload(args) {
      // TODO: replace lets with destructured args
      let
        tableName = args.tableName,
        revisionKey = args.revisionKey,
        value = args.value;

      capturedValue = value;

      return Bluebird.resolve({
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
      .then((result) => {
        assert.propertyVal(result, 'tableName', 'foo');
        assert.propertyVal(result, 'revisionKey', '123abc');

        assert.equal(capturedValue, "<!DOCTYPE html>\n");
      });
  });
});
