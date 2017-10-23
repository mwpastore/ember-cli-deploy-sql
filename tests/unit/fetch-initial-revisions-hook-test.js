/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');
const Bluebird = require('bluebird');

describe('DeployPlugin | fetchInitialRevisions hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  it('fetches the initial revisions', function() {
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

    return instance.fetchInitialRevisions(context)
      .then((results) => {
        assert.deepEqual(results, {
          initialRevisions: [
            {
              revision: 'a',
              active: false
            }
          ]
        });
      });
  });
});
