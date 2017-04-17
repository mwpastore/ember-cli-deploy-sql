// This configuration file is *only* used to test migrations
global.TABLE_NAME = 'foo_bar'; // FIXME

module.exports = {
  client: 'sqlite3',
  connection: {
    filename: '/tmp/ember-cli-deploy-sql.sqlite'
  },
  useNullAsDefault: true
}
