const io = require('socket.io-client');
const readline = require('readline');
const colors = require('colors/safe');

console.log('Connecting to server...');
const socket = io('http://localhost:3000/');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const availableColors = [
    'bgRed',
    'bgGreen',
    'bgYellow',
    'bgBlue',
    'bgMagenta',
    'bgCyan',
];

const state = {
    board: null,
    running: false,
    players: [],
    me: null,
};

function getPlayerColor(id) {
    for (let i = 0; i < state.players.length; i++) {
        if (state.players[i].id === id) {
            return colors[availableColors[i]];
        }
    }

    return colors.green;
}

function renderGame() {
    const board = Array(state.board.height)
        .fill(null)
        .map(() => Array(state.board.width).fill(' '));

    const ids = Object.keys(state.board.snakes);
    for (let i = 0; i < ids.length; i++) {
        const playerId = ids[i];
        const color = getPlayerColor(playerId);
        const snake = state.board.snakes[playerId]
        for (let j = 0; j < snake.length; j++) {
            const position = snake[j];
            board[position.y][position.x] = color(j === 0 ? 'x' : ' ');
        }
    }

    board[state.board.fruit.y][state.board.fruit.x] = colors.green('0');

    // Clear the terminal
    process.stdout.write('\033c');
    console.log(colors.bgWhite(Array(state.board.width + 2).fill(' ').join('')));
    for (let i = 0; i < board.length; i++) {
        console.log(colors.bgWhite(' ') + board[i].join('') + colors.bgWhite(' '));
    }
    console.log(colors.bgWhite(Array(state.board.width + 2).fill(' ').join('')));
}

function renderLobby() {
    if (!state.me) {
        return;
    }

    console.log(colors.bgBlue.black('\n\n= Players =======================================\n'));
    for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        let line = player.name;
        if (player.status === 'ready') {
            line += colors.green(' ready');
        } else {
            line += colors.yellow(' waiting');
        }
        console.log(line);
    }

    console.log(colors.bgBlue.black('\n================================================='));

    if (state.me.status === 'ready') {
        console.log('\nYou are ready. Waiting for the rest.');
    } else {
        console.log(colors.bgYellow.black('\nPress Enter to ready up'));
    }
}

async function getName() {
    let name;
    do {
        name = await new Promise(resolve => {
            rl.question('What\'s your name? ', (input) => {
                rl.close();
                resolve(input);
            });
        });
    } while (!name)
    console.log(`Your name is ${name}`);
    return name;
}

function getEnterPress() {
    return new Promise(resolve => {
        function onEnterPress(letter) {
            if (letter === '\n' || letter === '\r') {
                process.stdin.off('data', onEnterPress);
                resolve();
            }
        }

        process.stdin.on('data', onEnterPress);
    });
}

async function waitForReady() {
    await getEnterPress();
    state.me.status = 'ready';
    socket.emit('playerReady');
    renderLobby();
}

function enableTTYRawMode() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);

        // resume stdin in the parent process (node app won't quit all by itself
        // unless an error or process.exit() happens)
        process.stdin.resume();

        // i don't want binary, do you?
        process.stdin.setEncoding('utf8');

        // on any data into stdin
        process.stdin.on('data', function( key ){
          // ctrl-c ( end of text )
            if (key === '\u0003') {
                console.log('Bye');
                process.exit();
            }
        });
    }
}

async function main() {
    const name = await getName();
    await new Promise(resolve => socket.emit('playerJoined', name, (data) => {
        state.players = data.state.players;
        state.running = data.state.running;
        state.board = data.state.board;
        state.me = state.players.find(player => player.id === data.id);
        renderLobby();
        resolve();
    }));

    enableTTYRawMode();
    await waitForReady();
}

function onArrowKey(key) {
    if (key == '\u001B\u005B\u0041') {
        socket.emit('directionUpdate', 'up');
    }
    if (key == '\u001B\u005B\u0043') {
        socket.emit('directionUpdate', 'right');
    }
    if (key == '\u001B\u005B\u0042') {
        socket.emit('directionUpdate', 'down');
    }
    if (key == '\u001B\u005B\u0044') {
        socket.emit('directionUpdate', 'left');
    }
}

socket.on('connect', () => {
    console.log('Connected to server');
    main();
});

socket.on('disconnect', () => {
    console.log(colors.bgRed.black('Disconnected from server'));
    console.log('Waiting to reconnect...');
    rl.close();
    process.stdin.removeAllListeners('data');
    process.stdin.setRawMode(false);
});

socket.on('playerJoined', (player) => {
    state.players.push(player);

    renderLobby();
});

socket.on('playerLeft', (name) => {
    for (let i = 0; i < state.players.length; i++) {
        if (state.players[i].name === name) { 
            state.players.splice(i, 1);
            break;
        }
    }

    renderLobby();
});

socket.on('playerReady', (name) => {
    for (let i = 0; i < state.players.length; i++) {
        if (state.players[i].name === name) {
            console.log(`Player ${name} is ready`);
            state.players[i].status = 'ready';
            break;
        }
    }

    renderLobby();
});

socket.on('gameStart', (newState) => {
    state.players = newState.players;
    state.running = newState.running;
    state.board = newState.board;
    state.me = state.players.find(player => player.id === state.me.id);
    renderGame();
    process.stdin.on('data', onArrowKey);
    console.log('Game is starting in 3 seconds');
});

socket.on('gameTick', (board, events) => {
    state.board = board;
    renderGame();
});

socket.on('gameEnd', (data) => {
    state.players = data.state.players;
    state.running = data.state.running;
    state.board = data.state.board;
    state.me = state.players.find(player => player.id === state.me.id);

    const winner = state.players.find(p => p.id === data.winner);
    process.stdin.off('data', onArrowKey);
    if (winner.id === state.me.id) {
        console.log('You win!');
    } else {
        console.log(`${winner.name} won!`);
    }

    renderLobby();
    waitForReady();
});
