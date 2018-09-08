const io = require('socket.io-client');
const readline = require('readline');

console.log('Connecting to server...');
const socket = io('http://localhost:3000/');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const state = {
    board: null,
    running: false,
    players: [],
    me: null,
};

function renderGame() {

}

function renderLobby() {
    if (!state.me) {
        return;
    }

    console.log('\n\n= Players ==========');
    for (let i = 0; i < state.players.length; i++) {
        const player = state.players[i];
        let line = player.name;
        if (player.ready) {
            line += ' ready';
        } else {
            line += ' waiting';
        }
        console.log(line);
    }

    if (state.me.ready) {
        console.log('\nYou are ready. Waiting for the rest.');
    } else {
        console.log('\nPress Enter to ready up');
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
        state.players = data.players;
        state.running = data.running;
        state.board = data.board;
        state.me = state.players.find(player => player.name === name);
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

socket.on('playerJoined', (name, ready) => {
    state.players.push({
        name,
        ready,
    });

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

socket.on('gameStart', (update) => {
    console.log('Game is starting in 3 seconds');
    board = update;
});

socket.on('gameTick', (update) => {
    board = update.state;
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
