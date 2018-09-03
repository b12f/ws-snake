const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const GAME_TICK_SPEED = 200;
const state = {
    running: false,
    players: [],
    board: null, 
    interval: null,
};

const buffer = {
    directions: {},
};

function getInitialBoardState() {
    return {
        running: state.running,
        players: state.players.map(p =>({
            name: p.name,
            ready: p.ready,
        })),
        board: state.board,
    };
}

io.on('connection', function(socket){
    socket.on('playerJoined', function (name, callback) {
        console.log(`Player ${name} joined`);

        // Add the player to the state
        state.players.push({
            name,
            id: socket.id,
            ready: false,
        });

        // Broadcast this to all other players
        socket.broadcast.emit('playerJoined', name);

        // Send an initial dataset to the joining player
        callback(getInitialBoardState());
    });

    socket.on('playerReady', function () {
        // Get the current player and ready them up
        const player = state.players.find(player => player.id === socket.id);
        player.ready = true;

        console.log(`Player ${player.name} is ready`);

        // Broadcast this to all other players
        socket.broadcast.emit('playerReady', player.name);

        if (state.players.reduce((allReady, player) => allReady && player.ready, true)) {
            startGame();
        }
    });

    socket.on('directionUpdate', function (direction){
        buffer.directions[socket.id] = direction;
    });
});

function startGame() {
    // TODO: Initialize board here
    initState();
    
    // Emit the game start with the board state to all players
    io.sockets.emit('gameStart', state.board);

    // Start the game interval
    state.interval = setInterval(gameTick, GAME_TICK_SPEED);
}

function gameTick() {
    // TODO: Update the board here

    // TODO: Make this more than example code
    if (gameOver) {
        clearInterval(state.interval);
        io.sockets.emit('gameEnd');

        state.players.map(player => {
            player.ready = false;
            return player;
        });

        return;
    }

    // Emit the tick with the board state to all players,
    // `events` could be used to share game events like
    // player deaths or fruit spawns for that tick
    io.sockets.emit('gameTick', state.board, events);
}

function initState() {

}

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
