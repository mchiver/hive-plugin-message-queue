const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

var TestSetup = require( './TestSetup.js' );
var FileUtils = require( '@mchiver/hive-harness/Helpers/FileUtils.js' );

var ENTITY_NAME = 'mq-test-queue';


//---------------------------------------------------------------------
TEST.describe( 'MessageQueue Plugin Tests (Standalone)', function ()
{

	var hive = null;

	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		await TestSetup.setup();
		hive = await TestSetup.open_hive();
		await hive.InvokeTool( 'MessageQueue.ConfigEntity', { EntityName: ENTITY_NAME } );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		var entity_folder = PATH.join( hive.DataPath, 'Entities', hive.SanitizedUserName, 'MessageQueue', ENTITY_NAME );
		if ( await FileUtils.FolderExists( entity_folder ) )
		{
			await FileUtils.DeleteFolder( entity_folder, true );
		}
		TestSetup.cleanup();
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should publish a message and peek it', async function ()
	{
		var pub_result = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'order.created',
			Payload: { OrderId: 123, Amount: 99.95 },
		} );

		ASSERT.ok( pub_result.Success, 'publish should succeed' );
		ASSERT.ok( pub_result.Result.MessageId >= 1, 'should return a MessageId' );

		var peek_result = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'order.created',
		} );

		ASSERT.ok( peek_result.Success, 'peek should succeed' );
		ASSERT.ok( peek_result.Result.Messages.length >= 1, 'should see at least 1 message' );
		ASSERT.strictEqual( peek_result.Result.Messages[ 0 ].Payload.OrderId, 123 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should consume and ack a message', async function ()
	{
		await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
			Payload: { TaskId: 'abc' },
		} );

		var consume_result = await hive.InvokeTool( 'MessageQueue.Consume', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
		} );

		ASSERT.ok( consume_result.Success );
		ASSERT.strictEqual( consume_result.Result.Messages.length, 1 );
		var msg_id = consume_result.Result.Messages[ 0 ].MessageId;

		var ack_result = await hive.InvokeTool( 'MessageQueue.Ack', {
			EntityName: ENTITY_NAME,
			MessageId: msg_id,
		} );

		ASSERT.ok( ack_result.Success );
		ASSERT.ok( ack_result.Result.Success );

		var peek_result = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'task.ready',
		} );
		ASSERT.strictEqual( peek_result.Result.Messages.length, 0, 'consumed message should not appear in peek' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should subscribe and list subscriptions', async function ()
	{
		var sub_result = await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'order.*',
			Mode: 'notify',
		} );

		ASSERT.ok( sub_result.Success );
		ASSERT.ok( sub_result.Result.SubscriptionId >= 1 );

		var list_result = await hive.InvokeTool( 'MessageQueue.ListSubscriptions', {
			EntityName: ENTITY_NAME,
		} );

		ASSERT.ok( list_result.Success );
		var found = list_result.Result.Subscriptions.find( function ( s ) { return s.TopicPattern === 'order.*'; } );
		ASSERT.ok( found, 'should find the subscription' );
		ASSERT.strictEqual( found.Mode, 'notify' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should unsubscribe', async function ()
	{
		var sub_result = await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'temp.*',
			Mode: 'notify',
		} );

		var unsub_result = await hive.InvokeTool( 'MessageQueue.Unsubscribe', {
			EntityName: ENTITY_NAME,
			SubscriptionId: sub_result.Result.SubscriptionId,
		} );

		ASSERT.ok( unsub_result.Success );
		ASSERT.ok( unsub_result.Result.Success );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should reject and retry a message', async function ()
	{
		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
			Payload: { data: 'retry me' },
		} );
		var consume = await hive.InvokeTool( 'MessageQueue.Consume', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
		} );
		var msg_id = consume.Result.Messages[ 0 ].MessageId;

		var reject_result = await hive.InvokeTool( 'MessageQueue.Reject', {
			EntityName: ENTITY_NAME,
			MessageId: msg_id,
			Reason: 'test failure',
		} );

		ASSERT.ok( reject_result.Success );
		ASSERT.strictEqual( reject_result.Result.Action, 'retried' );

		var peek = await hive.InvokeTool( 'MessageQueue.Peek', {
			EntityName: ENTITY_NAME,
			Topic: 'retry.test',
		} );
		ASSERT.ok( peek.Result.Messages.length >= 1, 'retried message should be pending again' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should dead letter a message after max retries', async function ()
	{
		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'dlq.test',
			Payload: { data: 'will fail' },
		} );
		var msg_id = pub.Result.MessageId;

		for ( var i = 0; i < 3; i++ )
		{
			await hive.InvokeTool( 'MessageQueue.Consume', { EntityName: ENTITY_NAME, Topic: 'dlq.test' } );
			await hive.InvokeTool( 'MessageQueue.Reject', {
				EntityName: ENTITY_NAME,
				MessageId: msg_id,
				Reason: 'attempt ' + ( i + 1 ),
			} );
		}

		var dlq = await hive.InvokeTool( 'MessageQueue.ListDeadLetters', {
			EntityName: ENTITY_NAME,
			Topic: 'dlq.test',
		} );

		ASSERT.ok( dlq.Success );
		ASSERT.ok( dlq.Result.DeadLetters.length >= 1, 'should have at least 1 dead letter' );
		ASSERT.strictEqual( dlq.Result.DeadLetters[ 0 ].Topic, 'dlq.test' );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should invoke-mode subscription auto-dispatch a tool call', async function ()
	{
		await hive.InvokeTool( 'MessageQueue.Subscribe', {
			EntityName: ENTITY_NAME,
			TopicPattern: 'invoke.test',
			Mode: 'invoke',
			ToolCall: { PluginName: 'System', ToolName: 'Info', Arguments: {} },
		} );

		var pub = await hive.InvokeTool( 'MessageQueue.Publish', {
			EntityName: ENTITY_NAME,
			Topic: 'invoke.test',
			Payload: { trigger: true },
		} );

		ASSERT.ok( pub.Success, 'publish with invoke subscription should succeed' );
		ASSERT.ok( pub.Result.MessageId >= 1 );
	} );


	//-----------------------------------------------------------------
	TEST.it( 'should purge messages by topic', async function ()
	{
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.a', Payload: 1 } );
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.a', Payload: 2 } );
		await hive.InvokeTool( 'MessageQueue.Publish', { EntityName: ENTITY_NAME, Topic: 'purge.b', Payload: 3 } );

		var purge_result = await hive.InvokeTool( 'MessageQueue.PurgeQueue', {
			EntityName: ENTITY_NAME,
			Topic: 'purge.a',
		} );

		ASSERT.ok( purge_result.Success );
		ASSERT.strictEqual( purge_result.Result.Purged, 2, 'should purge 2 messages' );

		var peek = await hive.InvokeTool( 'MessageQueue.Peek', { EntityName: ENTITY_NAME, Topic: 'purge.b' } );
		ASSERT.ok( peek.Result.Messages.length >= 1, 'purge.b messages should remain' );
	} );


} );
