/*eslint-env node*/
'use strict';

const subject = require('../../index');
const assert  = require('../helpers/assert');

describe('DeployPlugin', function() {
  it('has a name', function() {
    let instance = subject.createDeployPlugin({
      name: 'sql'
    });

    assert.equal(instance.name, 'sql');
  });

  it('implements the correct hooks', function() {
    let plugin = subject.createDeployPlugin({
      name: 'sql'
    });

    assert.isDefined(plugin.configure);
    assert.isFunction(plugin.configure);

    assert.isDefined(plugin.setup);
    assert.isFunction(plugin.setup);

    assert.isDefined(plugin.fetchInitialRevisions);
    assert.isFunction(plugin.fetchInitialRevisions);

    assert.isDefined(plugin.upload);
    assert.isFunction(plugin.upload);

    assert.isDefined(plugin.willActivate);
    assert.isFunction(plugin.willActivate);

    assert.isDefined(plugin.activate);
    assert.isFunction(plugin.activate);

    assert.isDefined(plugin.fetchRevisions);
    assert.isFunction(plugin.fetchRevisions);

    assert.isDefined(plugin.didDeploy);
    assert.isFunction(plugin.didDeploy);

    assert.isDefined(plugin.teardown);
    assert.isFunction(plugin.teardown);
  });
});
