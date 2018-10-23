const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Position = require('./Position');

const GAME_TICK_SPEED = 100;
const INIT_SNAKE_LENGTH = 5;

const state = {
    running: false,
    players: [],
    board: null, 
    interval: null,
};

const buffer = {
    directions: {},
    lastDirections: {},
};

function getGameState() {
    return {
        running: state.running,
        players: state.players,
        board: state.board,
    };
}

io.on('connection', function(socket){
    let player;
    socket.on('playerJoined', function (name, callback) {
        console.log(`Player ${name} joined`);

        player = {
            name,
            id: socket.id,
            status: 'waiting',
        };

        // Add the player to the state
        state.players.push(player);

        // Broadcast this to all other players
        socket.broadcast.emit('playerJoined', player);

        // Send an initial dataset to the joining player
        callback({
            id: socket.id, 
            state: getGameState(),
        });
    });

    socket.on('playerReady', function () {
        console.log(`Player ${player.name} is ready`);

        player.status = 'ready';

        // Broadcast this to all other players
        socket.broadcast.emit('playerReady', player.name);

        if (
            state.players.length > 1 &&
            state.players.reduce((allReady, p) => allReady &&
            p.status === 'ready', true)
        ) {
            startGame();
        }
    });

    socket.on('directionUpdate', function (direction) {
        const lastDirection = buffer.lastDirections[socket.id];
        // Make sure the player only moves in allowed directions
        if (
            lastDirection === direction ||
            lastDirection === 'up' && direction === 'down' ||
            lastDirection === 'down' && direction === 'up' ||
            lastDirection === 'left' && direction === 'right' ||
            lastDirection === 'right' && direction === 'left'
        ) {
            return;
        }

        buffer.directions[socket.id] = direction;
    });

    socket.on('disconnect', () => {
        for (let i = 0; i < state.players.length; i++) {
            if (player === state.players[i]) { 
                state.players.splice(i, 1);
                console.log(`Player ${player.name} disconnected`);
                socket.broadcast.emit('playerLeft', player.name);
                player.status = 'dead';
                break;
            }
        }
    });
});

function startGame() {
    initState();
    
    // Emit the game start with the board state to all players
    state.players.map(player => {
        player.status = 'playing';
        return player;
    });
    io.sockets.emit('gameStart', getGameState());
    console.log('Game is starting in 3 seconds');

    // Start the game interval
    setTimeout(() => {
        state.interval = setInterval(gameTick, GAME_TICK_SPEED);
    }, 3000);
}

function gameTick() {
    updateBoard(state);

    let gameOver = state.players.filter(p => p.status === 'playing').length < 2;
    const events = [];
    if (gameOver) {
        clearInterval(state.interval);

        const winner = state.players.find(p => p.status === 'playing').id;
        state.players.map(player => {
            player.status = 'waiting';
            return player;
        });

        state.running = false;

        io.sockets.emit('gameEnd', {
            winner, 
            state: getGameState(),
        });
        return;
    }

    // Emit the tick with the board state to all players,
    // `events` could be used to share game events like
    // player deaths or fruit spawns for that tick
    io.sockets.emit('gameTick', state.board, events);
}

function updateBoard(currentState) {
    for (var i = 0; i < currentState.players.length; i++) {
        const player = currentState.players[i];
        if (player.status === 'dead') {
            continue;
        }
        const direction = buffer.directions[player.id];
        moveSnake(currentState, direction, player);
        buffer.lastDirections[player.id] = direction;
    }
}

function moveSnake(currentState, direction, player) {
    const snake = currentState.board.snakes[player.id];
    const position = snake[0].nextField(direction);
    if (state.board.fruit.equals(position)) {
        refruit(currentState);
    } else if (checkCollision(currentState, position)) {
        player.status = 'dead';
    } else {
        snake.pop();
    }

    snake.unshift(position);
}

function checkCollision(currentState, position){
    if (position.x < 1 || position.y < 1 || position.y >= state.board.height - 1 || position.x >= state.board.width - 1) {
        return true;
    }

    for (const snake in currentState.board.snakes) {
        for (const segment of currentState.board.snakes[snake]) {
            if(position.equals(segment)) {
                return true;
            }
        }
    }

    return false;
}

function refruit(currentState) {
    currentState.board.fruit = getFreePosition(currentState.board);
}

function initState() {
    state.board = {
        height: 35,
        width: 130,
        snakes: {},
        fruit: new Position(-1, -1)
    };

    const betweeSpace = Math.floor(state.board.width / (state.players.length + 1));
    const verticalMargin = Math.floor((state.board.height - INIT_SNAKE_LENGTH) / 2);

    for(let i = 0; i<state.players.length; i++) {
        
        const playerId = state.players[i].id;
        const x = betweeSpace * (i + 1);
        const modifier = i % 2 ? 1 : -1;
        let y = verticalMargin;
        buffer.directions[playerId] = 'up';
        buffer.lastDirections[playerId] = 'up';
        if (!(i % 2)) {
            y = state.board.height - verticalMargin;
            buffer.directions[playerId] = 'down';
            buffer.lastDirections[playerId] = 'down';
        }
        let maxY = i % 2 ? state.board.height - verticalMargin : verticalMargin;
        state.board.snakes[playerId] = [];

        for (; (i % 2 ? y < maxY : y > maxY); y += modifier) {
            state.board.snakes[playerId].push(
                new Position(
                    x, y
                )
            );
        }
    }

    state.board.fruit = getFreePosition(state.board);
}

function getFreePosition(board) {
    let x;
    let y;

    do {
        y = Math.floor(Math.random() * board.height);
        x = Math.floor(Math.random() * board.width);
    } while(!isFreePosition(board, new Position(x, y)))
    return new Position(x, y);
}

function isFreePosition(board, position) {
    if (board.fruit.equals(position)) {
        return false;
    }

    for(const snake in board.snakes) {
        for(const snakePosition of board.snakes[snake]) {
            if (snakePosition.equals(position)) {
                return false;
            }
        }
    }

    return true;
}

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});
