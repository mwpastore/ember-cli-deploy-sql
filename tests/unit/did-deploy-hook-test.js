/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert = require('../helpers/assert');

describe('DeployPlugin | didDeploy hook', function() {
  const mockUi = {
    verbose: true,
    messages: [],
    write: function() {},
    writeLine: function(message) {
      this.messages.push(message);
    }
  };

  it('prints a message about the non-activated revision', function() {
    const instance = subject.createDeployPlugin({
      name: 'sql'
    });

    const context = {
      ui: mockUi,
      deployTarget: 'test',
      distDir: 'tests',
      config: {
        sql: {
          client: 'mock'
        }
      },
      revisionData: {
        revisionKey: '123abc'
      }
    };

    instance.beforeHook(context);
    instance.configure(context);
    instance.didDeploy(context)

    const message = mockUi.messages.pop();
    assert.match(message, /eployed but did not activate revision .123abc./);
    assert.match(message, /deploy:activate test --revision=123abc/);
  });
});
