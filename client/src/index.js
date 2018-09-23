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

    // Clear the terminal
    // process.stdout.write('\033c');
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
        if (player.ready) {
            line += colors.green(' ready');
        } else {
            line += colors.yellow(' waiting');
        }
        console.log(line);
    }

    console.log(colors.bgBlue.black('\n================================================='));

    if (state.me.ready) {
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
    state.me.ready = true;
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
        process.stdin.setEncoding( 'utf8' );

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

socket.on('connect', () => {
    console.log('Connected to server');
    main();
});

socket.on('disconnect', () => {
    console.log(colors.bgRed.black('Disconnected from server'));
    console.log('Waiting to reconnect...');
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
            state.players[i].ready = true;
            break;
        }
    }

    renderLobby();
});

socket.on('gameStart', (board) => {
    console.log('Game is starting in 3 seconds');
    state.board = board;
    renderGame();
});

socket.on('gameTick', (board, events) => {
    state.board = board;
});

socket.on('gameEnd', (winningPlayer) => {
    if (winningPlayer === me.name) {
        console.log('You win!');
    } else {
        console.log(`${winningPlayer} won!`);
    }

    board = null;
    for (let player of players) {
        player.ready = false;
    }
});
