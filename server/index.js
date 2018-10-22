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
    dead: []
};

const buffer = {
    directions: {},
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
            ready: false,
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
        player.ready = true;
        console.log(`Player ${player.name} is ready`);

        // Broadcast this to all other players
        socket.broadcast.emit('playerReady', player.name);

        if (state.players.reduce((allReady, p) => allReady && p.ready, true)) {
            startGame();
        }
    });

    socket.on('directionUpdate', function (direction){
        buffer.directions[socket.id] = direction;
    });

    socket.on('disconnect', () => {
        for (let i = 0; i < state.players.length; i++) {
            if (player === state.players[i]) { 
                state.players.splice(i, 1);
                console.log(`Player ${player.name} disconnected`);
                socket.broadcast.emit('playerLeft', player.name);
                state.dead.push(player.id)
                break;
            }
        }
    });
});

function startGame() {
    // TODO: Initialize board here
    initState();
    
    // Emit the game start with the board state to all players
    io.sockets.emit('gameStart', state.board);
    console.log('Game is starting in 3 seconds');

    // Start the game interval
    setTimeout(() => {
        state.interval = setInterval(gameTick, GAME_TICK_SPEED);
    }, 3000);
}

function gameTick() {
    // TODO: Update the board here
    updateBoard(state);

    // TODO: Make this more than example code
    const gameOver = false;
    const events = [];
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

function updateBoard(currentState) {
    for (var i = 0; i < currentState.players.length; i++) {
        const currentId = currentState.players[i].id;
        if (currentState.dead.includes(currentId)) {
            continue;
        }
        const direction = buffer.directions[currentId];
        moveSnake(currentState, direction, currentState.board.snakes[currentId], currentId);
    }
    return;
}

function moveSnake(currentState, direction, snake, currentId) {
    const collision = checkCollision(currentState, snake[0].nextField(direction));
    snake.unshift(snake[0].nextField(direction));
    if (!collision.isFruit) {
        snake.pop();
    } else {
        refruit(currentState);
    }
    if (collision.isWall || collision.isSnake) {
        currentState.dead.push(currentId);
    }
}

function checkCollision(currentState, position){
    collision = {};
    collision.isFruit = state.board.fruit.equals(position);
    if (position.x < 1 || position.y < 1 || position.y >= state.board.height - 1 || position.x >= state.board.width - 1) {
        collision.isWall = true;
    }

    for (const snake in currentState.board.snakes) {
        for (const segment of currentState.board.snakes[snake]) {
            if(position.equals(segment)) {
                collision.isSnake = true;
            }
        }
    }
    return collision;
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
    }

    const betweeSpace = Math.floor(state.board.width / (state.players.length + 1));
    const verticalMargin = Math.floor((state.board.height - INIT_SNAKE_LENGTH) / 2);

    for(let i = 0; i<state.players.length; i++) {
        
        const playerId = state.players[i].id;
        const x = betweeSpace * (i + 1);
        const modifier = i % 2 ? 1 : -1;
        let y = verticalMargin;
        buffer.directions[playerId] = 'up';
        if (!(i % 2)) {
            y = state.board.height - verticalMargin;
            buffer.directions[playerId] = 'down';
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
