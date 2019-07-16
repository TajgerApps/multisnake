var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var timexe = require('timexe');

//routing
app.use(express.static(__dirname));

var snakes = [];
var screenWidth = 640;
var screenHeight = 480;
var fruits = [];
const speed = 0.5;
const snakePartSize = 8;
const fruitSize = 6;
const port = 3002;
var cps = 0;
var mps = 0;
var tpc = 0, tpcs = [0, 0];

function spawnFruit(i){
    fruits[i] = {
        x: Math.floor(Math.random() * screenWidth),
        y: Math.floor(Math.random() * screenHeight)
    }
}

io.on('connection', (socket) => {
	socket.on('identity', (id) => {
		socket.snakeId = id;
		console.log('connected: ', socket.snakeId);
		snakes[socket.snakeId] = {
			id: socket.snakeId,
			body: [{
		        x: Math.round(Math.random() * screenWidth),
                y: Math.round(Math.random() * screenHeight)
            }],
			color: '',
			velocityX: 0,
			velocityY: speed,
			snakePartSize: snakePartSize,
			fruitSize: fruitSize
		};
	});
	
	socket.on('color', (data) => {
		snakes[socket.snakeId].color = data;
	});

	socket.on('name', (name) => {
		snakes[socket.snakeId].name = name;
	});
	
	socket.on('direction', (direction) => {
		const id = socket.snakeId;
		switch (direction) {
			case 'up':
				if (snakes[id].velocityX != 0) {
					snakes[id].velocityX = 0;
					snakes[id].velocityY = -speed;
				}
				break;
			case 'down':
				if (snakes[id].velocityX != 0) {
					snakes[id].velocityX = 0;
					snakes[id].velocityY = speed;
				}
				break;
			case 'left':
				if (snakes[id].velocityY != 0) {
					snakes[id].velocityX = -speed;
					snakes[id].velocityY = 0;
				}
				break;
			case 'right':
				if (snakes[id].velocityY != 0) {
					snakes[id].velocityX = speed;
					snakes[id].velocityY = 0;
				}

		}
	});

	socket.on('message', (message) => {
		const id = socket.snakeId;
		io.sockets.emit('chat', {
			nick: snakes[id].name,
			message: message
		});
	});
	
	socket.on('disconnect', () => {
		delete snakes[socket.snakeId];
		console.log('disconnect', socket.snakeId);
	});

	socket.on('performance', () => {
		const NS_PER_SEC = 1e9;
		cps = cps[0] * NS_PER_SEC + cps[1];
		console.log('One cycle operations took ' + (cps/1000) + 'msec');
		mps = mps[0] * NS_PER_SEC + mps[1];
		console.log('One cycle messages took ' + (mps/1000) + 'msec');
		const ttpc = tpc[0] * NS_PER_SEC + tpc[1];
		console.log('One cycle waited ' + (ttpc/1000) + 'msec');
		io.sockets.emit('performance', [cps/1000, mps/1000, ttpc/1000]);
	});
});

function between(value, min, max) {
	return value >= min && value <= max;
}

function collisionSnakeFruit(snake) {
	const halfSnakeBodyPart = snakePartSize / 2;
	for (let i = 0; i < fruits.length; i++) {
		if (between(fruits[i].x, snake.body[0].x - halfSnakeBodyPart, snake.body[0].x + halfSnakeBodyPart)
			&& between(fruits[i].y, snake.body[0].y - halfSnakeBodyPart, snake.body[0].y + halfSnakeBodyPart)) {
			return i;
		}
	}
	return false;
}

function collisionInsideSnake(snake) {
	for (let i = 1; i < snake.body.length; i++) {
		if (snake.body[0].x === snake.body[i].x && snake.body[0].y === snake.body[i].y) {
			return true;
		}
	}
	return false;
}

function collisionOtherSnakes(snakeNo) {
	const testingSnake = snakes[snakeNo];
	for (let otherSnakeNo in snakes) {
		if (snakeNo === otherSnakeNo) {
			continue;
		}
		let snake = snakes[otherSnakeNo];
		for (let snakePartNo in snake.body) {
			if (testingSnake.body[0].x === snake.body[snakePartNo].x && testingSnake.body[0].y === snake.body[snakePartNo].y) {
				return true;
			}
		}
	}
	return false;
}

http.listen(port, function(){
    console.log('listening on *:' + port);
	for (let i=0; i < 380; i++) {
		spawnFruit(i);
	}
    const asdf = timexe("* * * * * * * 1", () => {
		tpc = process.hrtime(tpcs);
    	let start = process.hrtime();
        for (let snakeNo in snakes) {
            if (snakes[snakeNo] === 'undefinded') {
            	continue;
			}
			let snake = snakes[snakeNo];
			let collisionResult = collisionSnakeFruit(snake)
			if (collisionResult !== false) {
				snake.body.push({x: 0, y: 0});
				spawnFruit(collisionResult);
				io.sockets.emit('fruits', fruits);
			}
			collisionResult = collisionInsideSnake(snake);
			if (collisionResult === true) {
				snake.body = [{
					x: Math.round(Math.random() * screenWidth),
					y: Math.round(Math.random() * screenHeight)
				}];
			}
			collisionResult = collisionOtherSnakes(snakeNo);
			if (collisionResult === true) {
				snake.body = [{
					x: Math.round(Math.random() * screenWidth),
					y: Math.round(Math.random() * screenHeight)
				}];
			}
			for (let i = snake.body.length - 1; i > 0; i--) {
				snake.body[i] = {
					x: snake.body[i-1].x,
					y: snake.body[i-1].y
				};
			}
			snake.body[0].x = (snake.body[0].x + screenWidth + snake.velocityX) % screenWidth;
			snake.body[0].y = (snake.body[0].y + screenHeight + snake.velocityY) % screenHeight;
        }
		cps = process.hrtime(start);
		start = process.hrtime();
        io.sockets.emit('position', snakes);
		io.sockets.emit('fruits', fruits);
		mps = process.hrtime(start);
		tpcs = process.hrtime();
    });
	console.log(asdf);
});
