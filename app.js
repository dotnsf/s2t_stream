//. app.js
var express = require( 'express' ),
    bodyParser = require( 'body-parser' ),
    ejs = require( 'ejs' ),
    fs = require( 'fs' ),
    multer = require( 'multer' ),
    app = express();

var my_s2t = require( './my_s2t' );

var settings = require( './settings' );

app.use( multer( { dest: './tmp/' } ).single( 'voice' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//.  HTTP server
var http = require( 'http' ).createServer( app );
var io = require( 'socket.io' )( http );

//. S2T
var s2t_params = {
  objectMode: true,
  contentType: 'audio/mp3',
  model: settings.s2t_model,
  //keywords: [],
  //keywordsThreshold: 0.5,
  interimResults: true,
  maxAlternatives: 3
};
//var s2t_stream = my_s2t.s2t.recognizeUsingWebSocket( s2t_params );


//. Page for guest
app.get( '/', function( req, res ){
  res.render( 'index', {} );
});

app.post( '/voice', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var voice = req.body.voice;
  var uuid = req.body.uuid;
  var voicefile = './public/' + voice + '.mp3';

  processAudioFile( voicefile, uuid ).then( function( result ){
    res.write( JSON.stringify( { status: true }, 2, null ) );
    res.end();
  }).catch( function( err ){
    console.log( err );
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
    res.end();
  })
});

app.post( '/audio', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var audiopath = req.file.path;
  var audiotype = req.file.mimetype;
  //var imgsize = req.file.size;
  var ext = imgtype.split( "/" )[1];
  var audiofilename = req.file.filename;
  var filename = req.file.originalname;

  var audio = fs.readFileSync( audiopath );
});

app.post( '/setcookie', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var value = req.body.value;
  //console.log( 'value = ' + value );
  res.setHeader( 'Set-Cookie', value );

  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});

async function processAudioFile( filepath, uuid, deleteFileWhenFinished ){
  return new Promise( async function( resolve, reject ){
    var s2t_stream = my_s2t.s2t.recognizeUsingWebSocket( s2t_params );
    fs.createReadStream( filepath ).pipe( s2t_stream );
    s2t_stream.on( 'data', function( evt ){
      /*
      evt = {
        result_index: 1,
        results: [
          {
            final: false,
            alternatives: [
              {
                transcript: "xxx xxxx xx xxxxxx ..."
              }
            ]
          }
        ]
      }
      */
      sockets[uuid].emit( 'event_client_view', evt ); 
      if( evt.results[0].final ){
        var text = evt.results[0].alternatives[0].transcript;

      }
    });
    s2t_stream.on( 'error', function( evt ){
      if( deleteFileWhenFinished ){
        fs.unlinkSync( filepath );
      }
      reject( evt );
    });
    s2t_stream.on( 'close', function( evt ){
      if( deleteFileWhenFinished ){
        fs.unlinkSync( filepath );
      }
      resolve( true );
    });
  });
}


//. socket.io
var sockets = {};
io.sockets.on( 'connection', function( socket ){
  console.log( 'connected.' );

  //. 初期化時（ロード後の最初の resized 時）
  socket.on( 'init_client', function( msg ){
    console.log( 'init_client', msg );

    //. これでは初期化時以外でも目的のクライアントに返せるよう connection 時の socket を記憶しておく
    if( !sockets[msg.uuid] ){
      sockets[msg.uuid] = socket;
    }

    //. init_client を実行したクライアントにだけ init_client_view を返す
    sockets[msg.uuid].emit( 'init_client_view', msg ); 
  });
});


var port = process.env.PORT || 8080;
http.listen( port );
console.log( "server starting on " + port + " ..." );
