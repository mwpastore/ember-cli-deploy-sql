/*eslint-env node*/
'use strict';

const
  DeployClient = require('./lib/deploy-client'),
  DeployPluginBase = require('ember-cli-deploy-plugin'),
  Promise = require('bluebird'); // Knex uses Bluebird, so we will too.

//
// Private functions
//
const
  joinPath = require('path').join,
  readFile = Promise.promisify(require('fs').readFile);

function errorMessage(error) {
  this.log(error, { color: 'red' });

  return Promise.reject(error);
}

//
// Public API
//
const DeployPlugin = DeployPluginBase.extend({
  options: null,
  name: null,

  init(options) {
    this.options = options;
    this.name = options.name;
    this._super();
  },

  defaultConfig: {
    allowOverwrite: false,

    connection: {},

    deployClient: (context, pluginHelper) => {
      // TODO: replace let with destructured context
      let tunnel = context.tunnel;

      const
        client = pluginHelper.readConfig('client'),
        connection = pluginHelper.readConfig('connection'),
        migrations = pluginHelper.readConfig('migrations'),
        options = pluginHelper.readConfig('sqlOptions'),
        allowOverwrite = pluginHelper.readConfig('allowOverwrite'),
        maxRecentUploads = pluginHelper.readConfig('maxRecentUploads');

      if (!(connection.port || connection.socketPath) && tunnel && tunnel.srcPort) {
        connection.host = connection.host || 'localhost';
        connection.port = tunnel.srcPort;
      }

      return new DeployClient({
        client,
        connection,
        migrations,
        options,
        allowOverwrite,
        maxRecentUploads
      });
    },

    didDeployMessage: context => {
      // TODO: replace this statement and lets with destructured context
      context.revisionData = context.revisionData || {};

      let
        revisionKey = context.revisionData.revisionKey,
        activatedRevisionKey = context.revisionData.activatedRevisionKey,
        deployTarget = context.deployTarget;

      if (revisionKey && !activatedRevisionKey) {
        return `Deployed but did not activate revision \`${revisionKey}'. To activate, run:\n` +
          `    ember deploy:activate ${deployTarget} --revision=${revisionKey}\n`;
      }
    },

    distDir: context => context.distDir,

    filePattern: 'index.html',

    maxRecentUploads: 10,

    migrations: {
      tableName: 'ember_cli_deploy_migrations'
    },

    revisionKey: context => {
      // TODO: replace these statements and lets with destructured context
      context.commandOptions = context.commandOptions || {};
      context.revisionData = context.revisionData || {};

      let
        commandRevisionKey = context.commandOptions.revision,
        contextRevisionKey = context.revisionData.revisionKey;

      return commandRevisionKey || contextRevisionKey;
    },

    sqlOptions: {},

    tableName: context => `${context.project.name().replace(/-/g, '_')}_bootstrap`
  },

  requiredConfig: ['client'],

  //
  // Pipeline hooks
  //
  setup() {
    const
      deployClient = this.readConfig('deployClient'),
      tableName = this.readConfig('tableName');

    return deployClient.sanityCheck({ tableName })
      .catch(errorMessage.bind(this));
  },

  fetchInitialRevisions() {
    const
      deployClient = this.readConfig('deployClient'),
      tableName = this.readConfig('tableName');

    this.log(`Listing initial revisions in table: \`${tableName}'`, { verbose: true });

    return deployClient.fetchRevisions({ tableName })
      .then(initialRevisions => ({ initialRevisions }))
      .catch(errorMessage.bind(this));
  },

  upload() {
    const
      deployClient = this.readConfig('deployClient'),
      tableName = this.readConfig('tableName'),
      revisionKey = this.readConfig('revisionKey'),
      filePath = joinPath(
        this.readConfig('distDir'),
        this.readConfig('filePattern')
      );

    this.log(`Uploading \`${filePath}'`, { verbose: true });

    return readFile(filePath, 'utf8')
      .then(value => deployClient.upload({ tableName, revisionKey, value }))
      .then(args => {
        // TODO: replace lets with destructured args
        let
          tableName = args.tableName,
          revisionKey = args.revisionKey;

        this.log(`Uploaded to table \`${tableName}' with key \`${revisionKey}'`, { verbose: true });

        return { tableName, revisionKey };
      })
      .catch(errorMessage.bind(this));
  },

  willActivate() {
    const
      deployClient = this.readConfig('deployClient'),
      tableName = this.readConfig('tableName');

    return deployClient.activeRevisionKey({ tableName })
      .then(previousRevisionKey => ({ revisionData: { previousRevisionKey } }))
      .catch(errorMessage.bind(this));
  },

  activate() {
    const
      deployClient = this.readConfig('deployClient'),
      revisionKey = this.readConfig('revisionKey'),
      tableName = this.readConfig('tableName');

    this.log(`Activating revision \`${revisionKey}'`, { verbose: true });

    return deployClient.activateRevision({ tableName, revisionKey })
      .then(() => {
        this.log(`✔ Activated revision \`${revisionKey}'`);

        return { revisionData: { activatedRevisionKey: revisionKey } };
      })
      .catch(errorMessage.bind(this));
  },

  fetchRevisions() {
    const
      deployClient = this.readConfig('deployClient'),
      tableName = this.readConfig('tableName');

    this.log(`Listing revisions in table: \`${tableName}'`);

    return deployClient.fetchRevisions({ tableName })
      .then(revisions => ({ revisions }))
      .catch(errorMessage.bind(this));
  },

  didDeploy() {
    const didDeployMessage = this.readConfig('didDeployMessage');

    if (didDeployMessage) {
      this.log(didDeployMessage);
    }
  },

  teardown() {
    const deployClient = this.readConfig('deployClient');

    deployClient.destroy();
  }
});

module.exports = {
  name: 'ember-cli-deploy-sql',

  createDeployPlugin: options => new DeployPlugin(options)
};
