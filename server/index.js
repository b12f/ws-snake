const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const state = {
    players: [],
    action: [],
    
};

io.on('connection', function(socket){
    socket.on('playerJoined', function (msg) {
        state.players[socket.id] = msg;
        console.log(state.players);
    });

    socket.on('playerAction', function (msg) {
        state.players.push(msg);
        console.log(state.players);
    });
});

setInterval(function () {
    io.emit('tick', state);
}, 500);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});