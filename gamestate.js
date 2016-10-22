
// I'm naughty makes the code nicer
Array.prototype.random = function() {
	return this[ Math.floor(Math.random() * this.length) ];
}

Math.randomBetween = function(min,max) {
	var b = max - min + 1;
	return Math.floor( Math.random() * b + min );
}

function GameMode() {
	var _self = this;
	this.add = function (key,cb) {
		this[key] = cb;
	}
}

var _addition = new GameMode();
var _subtraction = new GameMode();
var _multiplication = new GameMode();
var _division = new GameMode();

var _gameData = {
	modes : {
		'Addition' : _addition,
		'Subtraction' : _subtraction,
		'Division' : _division,
		'Multiplication' : _multiplication
	},
	level : undefined,
	levels : [ {min:0,max:5,completed:25},
               {min:0,max:10,completed:25},
	           {min:0,max:20,completed:25},
	           {min:0,max:30,completed:25},
	           {min:0,max:50,completed:25},
	           {min:0,max:70,completed:25},
	           {min:0,max:100,completed:25}
	          ],
	difficulties : { 
		'training' : {mistakes:undefined,time:undefined}, // training should help you practice ones you don't know
		    'easy' : {mistakes:25,time:120}, 
	      'medium' : {mistakes:10,time:120}, 
	        'hard' : {mistakes:5,time:60}, 
	   'legendary' : {mistakes:2,time:45} 
	},
	music : undefined,
	problems : [],
	difficulty : 'easy',
	range : [ 0, 10 ],
	limits : undefined,
	mode : undefined,
	time : { level: undefined, total: undefined }
}

function getModes(mode) {
	return Object.keys(_gameData.modes);
}

function resetLevel() {
	_gameData.level = 0;
	_gameData.limits = _gameData.difficulties[ _gameData.difficulty];
	setRange( _gameData.levels[ _gameData.level ] );
	_gameData.problems = [];
	_gameData.problems[ _gameData.level ] = [];
	$('.progress #correct,.progress #completed').text("0");
}

function nextLevel() {
	if( ++_gameData.level < _gameData.levels.length ) {
		_gameData.problems[ _gameData.level ] = []
		setRange( _gameData.levels[ _gameData.level ] );

		$('#level').text(_gameData.level + 1);
		$('.progress #correct,.progress #completed').text("0");
		return true;
	}
}

function setDifficulty(difficulty) {
	if( difficulty in _gameData.difficulties ) {
		_gameData.difficulty = difficulty;
		_gameData.limits = _gameData.difficulties[difficulty];
		return true;
	}
}

function setModeState(mode) {
	if( mode in _gameData.modes ) {
		_gameData.mode = mode;
		_gameData.active = _gameData.modes[mode];
		return true;
	}
}

function setRange(range) {
	_gameData.range = [ range.min, range.max ];
}

function setupMode( gameState ) {
	var state;
	gameTransition( gameState.GetStateObject('gametransition') );
	game( gameState.GetStateObject('game') );
	gameGenerate( gameState.GetStateObject('gamegenerate') );
	gameWait( gameState.GetStateObject('gamewait') );
	gameResolve( gameState.GetStateObject('gameresolve') );
	gameLevelTransition( gameState.GetStateObject('gameleveltransition') )

	// state = gameState.GetStateObject('gamescoring');
	state = gameState.GetStateObject('menutransition');
	state.insert('stateupdate',function() {
		try {
			stopLoopingSound(_gameData.music);
			_gameData.music = undefined;
		} catch(e) {}
		try {
			document.removeEventListener("keydown", handleKeyPress);
		} catch(e) {}
		$('#canvas').addClass('hidden');
	});
}

function gameTransition(state) {
	state.insert('update',function() { // pass-in time object
		resetLevel();

		// challenge mode
		$('#challenge').text(_gameData.mode);
		$('#level').text(_gameData.level+1);
		$('.timer #minutes,.timer #seconds').text("00");
		$('#toast').text("Good luck!");
	});
	state.insert('postupdate',function() { // pass-in time object
		$('#canvas').removeClass('hidden');
		_Manager.state.TryUpdate('game');
	});
}

function game(state) {
	var sounds = [ createLoopingSound('POL-brave-worm-short.mp3') ];

	state.insert('stateupdate',function() {
		document.addEventListener("keydown", handleKeyPress);
		_gameData.music = sounds.random();
		playSound(_gameData.music);
	});

	state.insert('postupdate',function() {
		_Manager.state.TryUpdate('gamegenerate');
	});
}

function gameGenerate(state) {
	state.insert('stateupdate',function() {
		var problem = _gameData.active.problem();
		_gameData.problems[ _gameData.level ].push( problem );
	});

	state.insert('update',function() {
		// draw problem
		var cnt = _gameData.problems[ _gameData.level ].length;
		var data = _gameData.problems[ _gameData.level ][cnt-1];

		// update the problem
		$('#top').html(data.top);
		$('#sign').html(data.sign);
		$('#bottom').html(data.bottom);
		$('#answer').html("");
	} );

	state.insert('postupdate',function() {
		_Manager.state.TryUpdate('gamewait');
	} );
}

function gameWait(state) {
	state.insert('preupdate', function(){
		// check the keys that were pressed, update to the answer field
		var keys = _Manager.data.keys, lkeys = _Manager.data.keys.length, ikeys = 0, key, text;
		var $elem = $('#answer');
		
		for( ;ikeys < lkeys;ikeys++ ) {
			key = keys[ikeys];
			switch( key ) {
				case 'del' :
					$elem.text( $elem.text().slice(0, -1) );
					break;
				case 'clr' : 
					$elem.text( "" );
					break;
				case 'ans' :
					if( $elem.text() != "" ) {
						_Manager.state.TryUpdate('gameresolve');
					}
					break;
				default: 
					$elem.text( $elem.text() + key );
					break;
			}
		}
		_Manager.data.keys = [];

	});

	function format( value, pad, padChar ) {
		var res = "" + Math.floor(value);
		var cnt = res.length == pad ? 0 : pad - res.length;
		while( cnt-- > 0 ) {
			// slow for long strings
			res = padChar + res;
		}
		return res;
	}

	var startTime = new Date().getTime(), curTime, deltaTime;
	var $minContainer = $('#minutes'), $secContainer = $('#seconds'), $milContainer = $('#milliseconds');
	state.insert('update',function(time) {
		curTime = new Date().getTime();
		deltaTime = curTime - startTime;
		$minContainer.html( format( deltaTime / 60 / 1000, 2, "0" ) );
		$secContainer.html( format( (deltaTime / 1000) % 60, 2, "0" ) );
		$milContainer.html( format( (deltaTime / 100) % 100 , 2, "0" ) );
	});
}

function playSound(sound) {
	sound.currentTime = 0
	sound.volume = .5;
	sound.play();
}

function handlerLooping() {
	this.currentTime = 0;
	this.play();
}

function createLoopingSound(file) {
	var sound = new Audio(file); 
	sound.volume = .2;
	if( typeof sound.loop === 'boolean' ) {
		sound.loop = true;
	} else {
		sound.addEventListener('ended', handlerLooping, false);
	}
	return sound;
}

function stopLoopingSound(sound) {
	if( typeof sound.loop === 'boolean' ) {
		sound.loop = false;
	} else {
		sound.removeEventListener('ended', handlerLooping);
	}
	sound.volume = 0;
	sound.pause();
}

function gameResolve(state) {

	var phrases = { 
		correct: [ 'Great Job!', 'Super Star!', 'Fantastic!', 'Correct!', "Keep 'em Coming!" ],
		incorrect: [ 'Nice Try.', 'Almost.', 'Keep On Trying.', 'Close.' ]
	};
	var sounds = {
		correct : [ new Audio("Correct.mp3") ],
		incorrect : [ new Audio("Incorrect.mp3") ]
	};

	state.insert('preupdate',function() {
		var cnt = _gameData.problems[ _gameData.level ].length;
		var data = _gameData.problems[ _gameData.level ][cnt-1];

		$('#completed').text( cnt );
		data.answer = $('#answer').text();
		// TODO: get how long it took to answer

		if( parseFloat(data.answer) == parseFloat(data.expected) ) {
			$('#toast').text( phrases.correct.random() );
			var $elem = $('#correct');
			var value = parseInt($elem.text()) + 1;
			$elem.text( value );
			playSound(sounds.correct.random());
		} else {
			$('#toast').text( phrases.incorrect.random() );
			playSound(sounds.incorrect.random());
		}
	});

	state.insert('postupdate',function() {
		// when am I done, max number of questions
		// check timer as well here

		if( _gameData.levels[ _gameData.level ].completed <= _gameData.problems[_gameData.level].length ) {
			_Manager.state.TryUpdate('gameleveltransition');
		} else {
			_Manager.state.TryUpdate('gamegenerate');
		}
	});

}

function gameLevelTransition(state) {
	var levelTransition = false;
	state.insert('stateupdate',function() {
		levelTransition = nextLevel();
	});

	state.insert('preupdate',function() { 
		if( levelTransition ) {
			$('#toast').text( 'Level Up!' );
		}
	} );

	state.insert('postupdate',function() { 
		if( levelTransition ) {
			_Manager.state.TryUpdate('gamegenerate');
		} else {
			_Manager.state.TryUpdate('gamescore');
		}
	} );

}

_addition.add('problem', function() {
	// what is the range for the answer?
	// choose number between range
	var expected = Math.randomBetween( _gameData.range[0], _gameData.range[1] ),
	    top = Math.floor( Math.random() * expected ), 
	    bottom = Math.floor( expected - top );
	return { sign: '+', top: top, bottom: bottom, expected: expected, answer: undefined };
});

_subtraction.add('problem', function() {
	// what is the range for the answer?
	// choose number between range 
	var expected = Math.randomBetween( _gameData.range[0], _gameData.range[1] ),
	    top = Math.floor( Math.random() * expected ), 
	    bottom = Math.floor( expected - top );
	return { sign: '-', top: expected, bottom: top, expected: bottom, answer: undefined };
});

_multiplication.add('problem', function() {
	// what is the range for the answer?
	// choose number between range
	var expected = Math.randomBetween( _gameData.range[0], _gameData.range[1] );
	var top = Math.floor( Math.randomBetween(0,expected) );

	var bottom;
	if( top == 0 ) {
		bottom = expected;
		expected = 0;
	} else {
		while( top != 0 && top <= expected ) { 
			bottom = expected/top;
			if(bottom == Math.floor(bottom) ) {break;}
			top++; 
		}
	}
	return { sign: 'x', top: top, bottom: bottom, expected: expected, answer: undefined };
});

_division.add('problem', function() {
	var expected = Math.randomBetween( _gameData.range[0], _gameData.range[1] );
	var top = Math.floor( Math.randomBetween(0,expected) );

	var bottom = 0;
	if( top == 0 ) {
		bottom = top;
		top = expected;
		expected = 0;
	} else {
		while( top <= expected ) { 
			bottom = expected/top;
			if(bottom == Math.floor(bottom) ) {break;}
			top++; 
		}
	}
	return { sign: '&divide;', top: expected, bottom: top, expected: bottom, answer: undefined };
});