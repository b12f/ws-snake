const readline = require('readline');
const io = require('socket.io-client');
const colors = require('colors/safe');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Connecting to server...');
const socket = io('http://localhost:3000/');

const state = {
    board: null,
    running: false,
    players: [],
    me: null,
};

function renderGame() {

}

function renderLobby() {

}

async function getName() {
    let name;
    do {
        name = await new Promise(resolve => {
            rl.question('What\'s your name?\n', (input) => {
                rl.close();
                resolve(input);
            });
        });
    } while (!name)

    return name;
}

async function main() {
    const name = await getName();
    console.log(`Your name is ${name}`);
    socket.emit('playerJoined', name, (data) => {
        state.players = data.players;
        state.running = data.running;
        state.board = data.board;
        state.me = state.players.find(player => player.name === name);
    });
}

socket.on('connect', () => {
    console.log(colors.green('Connected to server'));
    main();
});

socket.on('playerJoined', (name, ready) => {
    state.players.push({
        name,
        ready,
    });

    console.log(colors.green(`Player ${name} joined`));
});

socket.on('playerLeft', (name) => {
    for (let i = 0; i < players.length; i++) {
        if (players[i].name === name) { 
            console.log(colors.red(`Player ${name} left`));
            players.splice(i, 1);
            return;
        }
    }
});

socket.on('playerReady', (name) => {
    for (let i = 0; i < players.length; i++) {
        if (players[i].name === name) {
            console.log(colors.green(`Player ${name} is ready`));
            players[i].ready = true;
            return;
        }
    }
});

socket.on('gameStart', (update) => {
    board = update;
});

socket.on('gameTick', (update) => {
    board = update.state;
});

socket.on('gameEnd', (winningPlayer) => {
    if (winningPlayer === me.name) {
        console.log(colors.green('You win!'));
    } else {
        console.log(colors.yellow(`${winningPlayer} won!`));
    }

    board = null;
    for (let player of players) {
        player.ready = false;
    }
});
