const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const state = {
    players: [],
    readyPlayers: [],
    board: []
};

const buffer = {
    actions: []
};

io.on('connection', function(socket){
    socket.on('playerJoined', function (msg) {
        state.players[socket.id] = msg;
        state.readyPlayers[socket.id] = false;
        io.emit('tick', state);
        console.log(state.players);
    });

    socket.on('playerReady', function () {
        state.readyPlayers[socket.id] = true;
        console.log(state.players);
    });

    socket.on('playerAction', function (msg){
        buffer.actions[socket.id] = msg;
    });
});

const interval = setInterval(function () {
    if (gameStart()){
        state = initState()
        io.emit('tick', 'gameStart');
    }
    if (gameEnd()){
        io.emit('tick', 'gameEnd');
        clearInterval(interval);
    }
    bufferToState();
    io.emit('tick', state);
}, 500);

function initState() {

}

function bufferToState() {

}

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});