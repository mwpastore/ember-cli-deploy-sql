/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');
const Bluebird = require('bluebird');

describe('DeployPlugin | fetchRevisions hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  it('fetches the revisions', function() {
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
            fetchRevisions() {
              return Bluebird.resolve([
                {
                  revision: 'a',
                  active: false
                }
              ]);
            }
          }),
          tableName: 'foo'
        }
      }
    };

    instance.beforeHook(context);
    instance.configure(context);

    return instance.fetchRevisions(context)
      .then((results) => {
        assert.deepEqual(results, {
          revisions: [
            {
              revision: 'a',
              active: false
            }
          ]
        });
      });
  });
});
