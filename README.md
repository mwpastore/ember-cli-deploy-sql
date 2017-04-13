# ember-cli-deploy-sql

[![npm version](https://badge.fury.io/js/ember-cli-deploy-sql.svg)](https://badge.fury.io/js/ember-cli-deploy-sql)
[![ember-cli-deploy](https://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/plugins/ember-cli-deploy-sql.svg)](http://ember-cli-deploy.github.io/ember-cli-deploy-version-badges/)
[![build status](https://travis-ci.org/mwpastore/ember-cli-deploy-sql.svg?branch=master)](https://travis-ci.org/mwpastore/ember-cli-deploy-sql)
[![code coverage](https://coveralls.io/repos/mwpastore/ember-cli-deploy-sql/badge.svg?branch=master)](https://coveralls.io/r/mwpastore/ember-cli-deploy-sql?branch=master)

This plugin, lovingly cribbed from [ember-cli-deploy-redis][8], uploads the
contents of a file, presumably index.html, to a specified database table.
PostgreSQL, MySQL/MariaDB, Oracle, and other relational database management
systems (RDBMS) are supported.

More often than not this plugin will be used in conjunction with the [lightning
method of deployment][1] where the Ember.js application assets will be served
from S3 and the index.html file will be served alongside your API from a
key-value store of some kind; in this case, a database table. However, it can
be used to upload the contents of any file.

This plugin supercedes [ember-cli-deploy-mysql][9], which is now deprecated.

## What is an Ember CLI Deploy plugin?

A plugin is an addon that can be executed as a part of the Ember CLI Deploy
pipeline. A plugin will implement one or more of the Ember CLI Deploy's
pipeline hooks.

For more information on what plugins are and how they work, please refer to the
[Plugin Documentation][2].

## Why would I use this instead of ember-cli-deploy-redis?

That's a great question. Redis is a more natural fit for this kind of problem
and you can do neat things like serve directly from NGINX. Databases, on the
other hand, aren't traditionally set up well for key-value storage and
retrieval, and it ends up being a somewhat clumsy solution.

In our case, we were only using Redis for this particular function, so it
seemed overkill to be running the service (and maintaining a connection pool to
it in our Ruby application). Also, our API responses (including the Ember.js
index) are already being cached (thanks to a reverse proxy), so talk about
redundant layers!  It makes more sense for us, for now, to serve the index from
a database table and let our reverse proxy cache it. Perhaps your situation is
similar?

## Quick Start

To get up and running quickly, do the following:

* Ensure [ember-cli-deploy-build][4] is installed and configured.

* Install this plugin:

    ```sh
    $ ember install ember-cli-deploy-sql
    ```

* Install the [appropriate driver](http://knexjs.org/#Installation-node):

    ```sh
    $ yarn add <your-database-type> --dev
    ```

    Or if you're still using npm:

    ```sh
    $ npm install <your-database-type> --save-dev
    ```

* Place the following configuration into `config/deploy.js`:

    ```javascript
    ENV.sql = {
      client: '<your-database-type>',
      connection: '<your-connection-string>'
    }
    ```

* Run the pipeline:

    ```sh
    $ ember deploy <environment>
    ```

## Installation

Run the following command in your terminal:

```sh
ember install ember-cli-deploy-sql
```

## Ember CLI Deploy Hooks Implemented

For detailed information on what plugin hooks are and how they work, please
refer to the [Plugin Documentation][2].

* `activate`
* `didDeploy`
* `fetchInitialRevisions`
* `fetchRevisions`
* `upload`
* `willActivate`

## Configuration Options

For detailed information on how configuration of plugins works, please refer to
the [Plugin Documentation][2].

### client

### connection

### sqlOptions

These options are assembled and passed to [Knex.js][3]. Knex is used as a
query builder and database abstraction layer (DAL). Please see its
documentation for more information on these options. N.B.:

* `connection` can be either a string or an object.
* If a tunnel is present (see below), its port (and host `localhost` unless
  otherwise specified) will be automatically added to the `connection` object.
* `sqlOptions` is an optional object that may include any additional top-level
  configurables to pass to Knex, such as `searchPath`, `debug`, `pool`, etc.

### filePattern

A file matching this pattern will be uploaded to the database table.

*Default:* `'index.html'`

### tableName

The name of the database table in which to store the revision keys and file
contents. By default this option will use the `project.name()` property from
the deployment context.

The table is created in your database automatically on the initial deploy, so
your database user will need `CREATE TABLE` privileges&mdash;at least
temporarily!

The table looks something like this (e.g. in MySQL):

| Field       | Type         | Null | Key | Default           | Extra          |
| ----------- | ------------ | ---- | --- | ----------------- | -------------- |
| id          | int(11)      | NO   | PRI | NULL              | auto_increment |
| key         | varchar(255) | NO   | UNI | NULL              |                |
| value       | text         | NO   |     | NULL              |                |
| gitsha      | binary(20)   | YES  |     | NULL              |                |
| deployer    | varchar(255) | YES  |     | NULL              |                |
| description | varchar(255) | YES  |     | NULL              |                |
| is_active   | tinyint(1)   | NO   |     | 0                 |                |
| created_at  | timestamp    | NO   |     | CURRENT_TIMESTAMP |                |

*Default:* `${projectNameSnakeCased}_bootstrap`

### allowOverwrite

A flag to specify whether the revision should be overwritten if it already
exists in the database table.

*Default:* `false`

### maxRecentUploads

The maximum number of recent revisions to keep in the MySQL table.

*Default:* `10`

## Prerequisites

The following properties are expected to be present on the deployment `context`
object:

* `distDir` (unless a `distDir` is given in the config; provided by
  [ember-cli-deploy-build][4])
* `project.name()` (unless a `tableName` is given in the config; provided by
  [ember-cli-deploy][5])
* One of:
  * `revisionData.revisionKey` (provided by [ember-cli-deploy-revision-data][6])
  * `commandOptions.revisionKey` (provided by [ember-cli-deploy][5])
* `deployEnvironment` (provided by [ember-cli-deploy][5])

The following properties are used if present on the deployment `context`
object:

* `tunnel.srcPort` (provided by [ember-cli-deploy-ssh-tunnel][7])

## Activation

As well as uploading a file to the database table, *ember-cli-deploy-sql* has
the ability to mark any revision of a deployed file as currently active.

The application could be configured to return any existing revision of the
`index.html` file as requested by a query parameter. However, the revision
marked as the currently active revision would be returned if no query parameter
is present. For more detailed information on this method of deployment please
refer to the [ember-cli-deploy-lightning-pack README][1].

### How do I activate a revision?

A user can activate a revision by either:

* Passing an additional command line argument to the `deploy` command:

    ```sh
    $ ember deploy <environment> --activate
    ```

* Running the `deploy:activate` command:

    ```sh
    $ ember deploy:activate <environment> --revision=<revision-key>
    ```

* Setting the `activateOnDeploy` flag in `config/deploy.js`

    ```javascript
    ENV.pipeline = {
      activateOnDeploy: true
    }
    ```

  This has the same effect as passing `--activate` on every invocation of `ember
  deploy`.

### What does activation do?

When *ember-cli-deploy-sql* uploads a file, it uploads it to the table defined
by the `tableName` config property (which may be derived from the project name,
with a key defined by the `revisionKey` config property (which may be derived
from the file contents). So if there have been three revisons deployed (but
not activated), the table might look something like this:

```sh
$ mysql -u root foo

MariaDB [foo]> select `key`, left(`value`, 10), is_active from bar_bootstrap;
+----------------------------------+-------------------+-----------+
| key                              | left(`value`, 10) | is_active |
+----------------------------------+-------------------+-----------+
| cc9d9af44ad70f4a6732c1c13deb246e | <!DOCTYPE         | 0         |
| 071be39412920947613c00d680b8e9c0 | <!DOCTYPE         | 0         |
| d56d56274aac91e229fa69f34f4cf81d | <!DOCTYPE         | 0         |
+----------------------------------+-------------------+-----------+
```

Activating a revison would update the corresponding entry in the database
table:

```sh
$ ember deploy:activate production --revision=cc9d9af44ad70f4a6732c1c13deb246e
✔ Activated revision `cc9d9af44ad70f4a6732c1c13deb246e`
$ mysql -u root foo

MariaDB [foo]> select `key`, left(`value`, 10), is_active from bar_bootstrap;
+----------------------------------+-------------------+-----------+
| key                              | left(`value`, 10) | is_active |
+----------------------------------+-------------------+-----------+
| cc9d9af44ad70f4a6732c1c13deb246e | <!DOCTYPE         | 1         |
| 071be39412920947613c00d680b8e9c0 | <!DOCTYPE         | 0         |
| d56d56274aac91e229fa69f34f4cf81d | <!DOCTYPE         | 0         |
+----------------------------------+-------------------+-----------+
```

### When does activation occur?

Activation occurs during the `activate` hook of the pipeline. By default,
activation is turned off and must be explicitly enabled by one of the three
methods described above.

## What if my MySQL server isn't publicly accessible?

Not to worry!  Just install the handy-dandy [ember-cli-deploy-ssh-tunnel][7]
plugin:

```
ember install ember-cli-deploy-ssh-tunnel
```

And set up your `config/deploy.js` similar to the following:

```js
ENV = {
  sql: {
    client: '<your-database-type>',
    connection: {
      // everything except host and port!
    }
  },
  'ssh-tunnel': {
    username: 'your-ssh-username',
    host: 'remote-mysql-host'
  }
}
```

### What if my MySQL server is only accessible *from* my remote server?

Sometimes you need to SSH into a server (a "bastion" host) and then run `mysql`
or what have you from there. This is really common if you're using RDS on AWS,
for instance. Ember CLI Deploy has got you covered there, too: just set your
SSH tunnel host to the bastion server and tell the tunnel to use your database
server as the destination host, like so:

```js
ENV = {
  sql: { /* yada yada */ },
  'ssh-tunnel': {
    username: 'your-ssh-username',
    host: 'remote-mysql-client',
    dstHost: 'remote-mysql-server'
  }
}
```

## Migrating from ember-cli-deploy-mysql

1. Remove ember-cli-deploy-mysql from your project:

    ```sh
    $ yarn remove ember-cli-deploy-mysql
    ```

    Or if you're still using npm:

    ```sh
    $ npm uninstall ember-cli-deploy-mysql --save-dev
    ```

1. Add *ember-cli-deploy-sql* to your project:

    ```sh
    $ ember install ember-cli-deploy-sql
    ```

1. Add a MySQL/MariaDB driver to your project:

    ```sh
    $ yarn add mysql --dev
    ```

    Or if you're still using npm:

    ```sh
    $ npm install mysql --save-dev
    ```

1. Update `config/deploy.js` to use the `sql` key (instead of `mysql`), and
   adapt your connection options to Knex syntax:

    Before:

    ```javascript
    mysql: {
      user: 'jack',
      password: process.env.MYSQL_PASSWORD,
      database: 'momotaro'
    }
    ```

    After:

    ```javascript
    sql: {
      client: 'mysql',
      connection: {
        user: 'jack',
        password: process.env.MYSQL_PASSWORD,
        database: 'momotaro'
      }
    }
    ```

1. Update the schema to reflect some minor changes:

    ```sql
    ALTER TABLE `foo_bootstrap` -- replace with your table name
    ADD COLUMN `description` VARCHAR(255) AFTER `deployer`,
    ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 0 AFTER `description`,
    ADD INDEX(`is_active`);
    ```

1. Ask your team to hold off on any deployments for a bit!

1. Mark the current revision as active:

    ```sql
    SELECT @current := `value`
    FROM `foo_bootstrap` -- replace with your table name
    WHERE `key` LIKE 'current'
    LIMIT 1;

    UPDATE `foo_bootstrap` -- replace with your table name
    SET `is_active` = 1
    WHERE `key` = @current;
    ```

1. Update your backend to serve the revision `` WHERE `is_active` = 1 ``
   (instead of the revision pointed to by the `'current'` revision).

1. Remove the now-unnecessary `'current'` revision:

    ```sql
    DELETE FROM `foo_bootstrap` -- replace with your table name
    WHERE `key` LIKE 'current'
    LIMIT 1;
    ```

If push comes to shove, you can always rename or drop the table and
re-deploy&mdash;losing your history but getting back up and running. Please
open an issue report if you hit any snags!

## Tests

* `yarn install && yarn test`

## Why `ember test` doesn't work

Since this is a node-only Ember CLI addon, we use mocha for testing and this
package does not include many files and devDependencies which are part of Ember
CLI's typical `ember test` processes.

[1]: https://github.com/lukemelia/ember-cli-deploy-lightning-pack
[2]: http://ember-cli.github.io/ember-cli-deploy/plugins
[3]: http://knexjs.org
[4]: https://github.com/ember-cli-deploy/ember-cli-deploy-build
[5]: https://github.com/ember-cli/ember-cli-deploy
[6]: https://github.com/ember-cli-deploy/ember-cli-deploy-revision-data
[7]: https://github.com/ember-cli-deploy/ember-cli-deploy-ssh-tunnel
[8]: https://github.com/ember-cli-deploy/ember-cli-deploy-redis
[9]: https://github.com/mwpastore/ember-cli-deploy-mysql
