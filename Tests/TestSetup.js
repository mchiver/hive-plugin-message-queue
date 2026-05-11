/*
	TestSetup.js
---------------------------------------------------------------------
Shared test setup for the standalone MessageQueue plugin test suite.
Creates a temporary registry with this plugin linked in.
*/

const PATH = require( 'path' );
const FS = require( 'fs' );

const Registry = require( '@mchiver/hive-harness/Source/Registry.js' );
const Hive = require( '@mchiver/hive-harness/Source/Hive.js' );
const FileUtils = require( '@mchiver/hive-harness/Helpers/FileUtils.js' );


var PLUGIN_ROOT = PATH.join( __dirname, '..' );
var TEST_REGISTRY_PATH = PATH.join( require( 'os' ).tmpdir(), 'hive-plugin-mq-tests-' + Date.now() );
var TESTUSER_NAME = 'testuser';
var TESTUSER_PASSWORD_HASH = '$2b$10$6rP.rkIRE/zHp9V/fN3pluUbYq/heAsejzRUZyR/1ubHjzvw4lj4q';

function remove_folder( Path )
{
	if ( !FS.existsSync( Path ) ) { return; }
	FS.rmSync( Path, { recursive: true, force: true } );
}

async function setup()
{
	remove_folder( TEST_REGISTRY_PATH );
	await FileUtils.EnsureFolder( TEST_REGISTRY_PATH );
	await FileUtils.EnsureFolder( PATH.join( TEST_REGISTRY_PATH, 'Plugins' ) );
	await FileUtils.EnsureFolder( PATH.join( TEST_REGISTRY_PATH, 'Users' ) );
	await FileUtils.EnsureFolder( PATH.join( TEST_REGISTRY_PATH, 'Hives' ) );

	await FileUtils.WriteJson( PATH.join( TEST_REGISTRY_PATH, 'registry.config.json' ), {
		Version: '1.0.0',
		Description: 'Test registry for MessageQueue plugin',
		DefaultRole: 'guest',
		CreatedAt: new Date().toISOString(),
	} );

	var plugin_link_folder = PATH.join( TEST_REGISTRY_PATH, 'Plugins', 'MessageQueue' );
	await FileUtils.EnsureFolder( plugin_link_folder );
	await FileUtils.WriteJson( PATH.join( plugin_link_folder, 'plugin.link.json' ), {
		Path: PLUGIN_ROOT,
	} );

	await FileUtils.WriteJson( PATH.join( TEST_REGISTRY_PATH, 'Users', TESTUSER_NAME + '.json' ), {
		Name: 'Test User',
		Description: 'Test user for message-queue plugin',
		Role: 'admin',
		PasswordHash: TESTUSER_PASSWORD_HASH,
	} );

	await FileUtils.WriteJson( PATH.join( TEST_REGISTRY_PATH, 'Users', 'default.json' ), {
		Description: 'Default zero-config user.',
		Role: 'user',
		CreatedAt: new Date().toISOString(),
	} );

	return TEST_REGISTRY_PATH;
}

async function open_hive()
{
	var registry = await Registry.Open( TEST_REGISTRY_PATH );
	var hive_root = PATH.join( TEST_REGISTRY_PATH, 'Hives', 'test' );
	await FileUtils.EnsureFolder( hive_root );
	return await Hive.Open( registry, hive_root, TESTUSER_NAME, 'test123' );
}

function cleanup()
{
	remove_folder( TEST_REGISTRY_PATH );
}

module.exports = {
	PLUGIN_ROOT: PLUGIN_ROOT,
	TEST_REGISTRY_PATH: TEST_REGISTRY_PATH,
	TESTUSER_NAME: TESTUSER_NAME,
	setup: setup,
	open_hive: open_hive,
	cleanup: cleanup,
	remove_folder: remove_folder,
};
