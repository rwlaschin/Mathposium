
// I'm naughty makes the code nicer
Array.prototype.random = function() {
	return this[ Math.randomBetween(0,this.length-1) ];
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
	levels : [ {min:0,max:5,base:{min:0,max:"max",step:1},completed:25},
               {min:0,max:10,base:{min:5,max:"max",step:1},completed:25},
	           {min:0,max:20,base:{min:5,max:"max",step:3},completed:25},
	           {min:0,max:30,base:{min:10,max:"max",step:4},completed:25},
	           {min:0,max:50,base:{min:10,max:"max",step:8},completed:25},
	           {min:0,max:70,base:{min:15,max:"max",step:13},completed:25},
	           {min:0,max:100,base:{min:20,max:"max",step:16},completed:25}
	          ],
	difficulties : { 
		'training' : {mistakes:undefined,time:undefined,multiplier:0,base:1}, // training should help you practice ones you don't know
		    'easy' : {mistakes:25,time:120,multiplier:2,base:100}, 
	      'medium' : {mistakes:10,time:120,multiplier:3,base:150}, 
	        'hard' : {mistakes:5,time:60,multiplier:4,base:175}, 
	   'legendary' : {mistakes:2,time:45,multiplier:5,base:200} 
	},
	score : undefined,
	music : undefined,
	problems : [],
	difficulty : 'easy',
	range : { min:0, max:10, base:undefined },
	correct : undefined,
	mistakes : undefined,
	streak : 0,
	limits : undefined,
	mode : undefined,
	time : { delta: 0, average: undefined, level: undefined, total: undefined }
}

function getModes(mode) {
	return Object.keys(_gameData.modes);
}

function resetLevel() {
	_Manager.data.keys = [];
	_gameData.level = 0;
	_gameData.mistakes = 0;
	_gameData.limits = _gameData.difficulties[ _gameData.difficulty];
	var levelData = _gameData.levels[ _gameData.level ];
	setRange( levelData, getSkill(levelData) );
	_gameData.problems = [];
	_gameData.problems[ _gameData.level ] = [];
	_gameData.correct = 0;
	_gameData.streak = 0;
	_gameData.score = 0;
	_gameData.time = { delta: 0, average: undefined, level: 0, total: 0 };
	$('.progress #correct,.progress #completed,.progress #mistakes').text("0");
}

function nextLevel() {
	if( isMaxSkill( _gameData.levels[ _gameData.level ] ) ) {
		++_gameData.level;

		_gameData.problems[ _gameData.level ] = [];
		_gameData.time.level = 0;
		_gameData.correct = 0;
		$('#level').text(_gameData.level + 1);
		$('.progress #correct,.progress #completed').text("0");
		$('#toast').text( 'Level Up!' );
	} else {
		$('#toast').text( 'Skill Up!' );
	}
	if( _gameData.level < _gameData.levels.length ) {
		var levelData = _gameData.levels[ _gameData.level ]
		setRange( levelData, getSkill(levelData) );
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

function setRange(range, base) {
	_gameData.range = { min: range.min, max: range.max, base: base};
}

function getSkill(levelData) {
	var min = Number.isInteger(levelData.base.min) ? levelData.base.min : levelData[levelData.base.min], 
	    max = Number.isInteger(levelData.base.max) ? levelData.base.max : levelData[levelData.base.max];
	if( _gameData.range.base === undefined ) {
		return min;
	}
	var next = _gameData.range.base+levelData.base.step;
	if( next >= max )
		return max;
	return next;
}

function isMaxSkill(levelData) {
	var max = Number.isInteger(levelData.base.max) ? levelData.base.max : levelData[levelData.base.max];
	return ( _gameData.range.base >= max );
}

function setupMode( gameState ) {
	var sounds = [ new Audio('Complete.mp3') ];

	var state;
	gameTransition( gameState.GetStateObject('gametransition') );
	game( gameState.GetStateObject('game') );
	gameGenerate( gameState.GetStateObject('gamegenerate') );
	gameWait( gameState.GetStateObject('gamewait') );
	gameResolve( gameState.GetStateObject('gameresolve') );
	gameLevelTransition( gameState.GetStateObject('gameleveltransition') )

	state = gameState.GetStateObject('gamescoring');
	state.insert('stateupdate',function() {
		stopSound(_gameData.music);
		playSound(sounds.random());

		$('#scoreboardContainer').removeClass('hidden');
		var $info = $('#scoreboard');
		$info.find('#highscore').html(_gameData.score );
		// just get text from time elements??
		$info.find('#totaltime').html( $('.timer').text() );

		var totalCorrect = _gameData.correct;
		for(var i=_gameData.level-1;i>=0;i--) {
			totalCorrect+=_gameData.levels[ i ].completed;
		}

		$info.find('#correct').html(totalCorrect);

		var nextSkill = 5 - _gameData.correct%5;
		var nextLevel = _gameData.levels[ _gameData.level ].completed - _gameData.correct;

		$info.find('#nextskillup').html( Math.min( nextSkill, nextLevel) );
	});
	state.insert('statecomplete',function() {
		$('#scoreboardContainer').addClass('hidden');
	});

	state = gameState.GetStateObject('menutransition');
	state.insert('stateupdate',function() {
		try {
			stopSound(_gameData.music);
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
		$('#score').attr('tgt',0);
		$('#score').html(0);
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
	var $score = $('#score');
	state.insert('stateupdate', function(){ 
		_gameData.time.delta = 0;
	});
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
	state.insert('update',function(timer) {
		var scr = parseInt($score.text()), tgt = parseInt($score.attr('tgt'));
		if( tgt > scr ) {
			var value = scr + Math.floor((tgt - scr) / 20);
			$score.text( value > tgt ? tgt : value );
		}
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

	var $minContainer = $('#minutes'), $secContainer = $('#seconds'), $milContainer = $('#milliseconds');
	state.insert('update',function(time) {
		_gameData.time.delta += time.delta;
		_gameData.time.level += time.delta;
		_gameData.time.total += time.delta;
		$minContainer.html( format( (_gameData.time.total / 60) % 60, 1, "0" ) );
		$secContainer.html( format( (_gameData.time.total ) % 60, 2, "0" ) );
		$milContainer.html( format( (_gameData.time.total * 100) % 100 , 2, "0" ) );
	});
}

function playSound(sound) {
	try {
		sound.pause();
		sound.currentTime = 0;
		sound.volume = .5;
		if( sound.prevVol > 0 ) {
			sound.volume = sound.prevVol;
		}
		sound.play();
	} catch (e) {
		console.error(e);
	}
}

function stopSound(sound) {
	if( sound.volume > 0 ) {
		sound.prevVol = sound.volume;
	}
	sound.volume = 0;
	sound.pause();
}

function handlerLooping() {
	try {
		this.pause();
		this.prevVol = this.volume;
		this.volume = .2;
		this.currentTime = 0;
		this.play();
	} catch (e) {
		console.error(e);
	}
}

function createLoopingSound(file) {
	var sound = new Audio(file); 
	try {
		sound.prevVol = 
			sound.volume = .2;
		if( typeof sound.loop === 'boolean' ) {
			sound.loop = true;
		} else {
			sound.addEventListener('ended', handlerLooping, false);
		}
	} catch(e) {
		console.error(e);
	}
	return sound;
}

function setSoundVolume(element) {
	if( ! _gameData.music ) {
		return;
	}
	if(element.checked) {
		// mute
		_gameData.music.prevVol = _gameData.music.volume;
		_gameData.music.volume = 0;
	} else {
		// unmute
		_gameData.music.volume = _gameData.music.prevVol;
	}
}

function calculateScore() {
/*  NOT BEING USED YET */
/*  NOT BEING USED YET */
/*  NOT BEING USED YET */

	var bonus = 0;
	var total = 0;
	// var 

	if( _gameData.time.delta < _gameData.time.average ) {
		// bonus
	}

	switch(streak) {
		case 0: break;
		case 1: break;
		case 2: break;
		case 3: break;
		case 4: break;
		default: break;
	}

	return { bonus: 0, total: 0, types};
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
		function incrementValue($elem) {
			var value = parseInt($elem.text()) + 1;
			$elem.text( value );
		}
		var cnt = _gameData.problems[ _gameData.level ].length;
		var data = _gameData.problems[ _gameData.level ][cnt-1];

		$('#completed').text( cnt );
		data.answer = $('#answer').text();
		data.time = _gameData.time;
		_gameData.time.average = _gameData.time.average * (cnt-1) + _gameData.time.delta;

		if( parseFloat(data.answer) == parseFloat(data.expected) ) {
			_gameData.correct++;
			$('#toast').text( phrases.correct.random() );
			incrementValue( $('#correct') );
			playSound(sounds.correct.random());
			_gameData.streak++;

			var score = (data.top - Math.abs(data.bottom - data.top))/10+_gameData.difficulties[_gameData.difficulty].base
			;
			var bonus = _gameData.difficulties[_gameData.difficulty].multiplier + _gameData.streak/3;
			_gameData.score += Math.round(score * bonus);

		} else {
			_gameData.streak = 0;
			_gameData.mistakes++;
			incrementValue( $('#mistakes') );
			$('#toast').text( phrases.incorrect.random() );
			playSound(sounds.incorrect.random());
		}
	});

	state.insert('postupdate',function() {
		var progress = _gameData.correct;
		var time = _gameData.time.level / 1000; // miliseconds to seconds

		$('#score').attr('tgt',_gameData.score);
		
		if(  _gameData.limits.mistakes !== undefined && _gameData.mistakes >= _gameData.limits.mistakes 
		  || _gameData.limits.time !== undefined && time >= _gameData.limits.time ) {
		  	_Manager.state.TryUpdate('gamescoring');
		} else if(   ( progress > 0 && progress%5==0 )
			|| _gameData.levels[ _gameData.level ].completed <= progress ) {
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
	var expected = Math.randomBetween( _gameData.range.min, _gameData.range.max ),
	    top = Math.randomBetween(0, Math.min(expected,_gameData.range.base)), 
	    bottom = Math.floor( expected - top );
	return { sign: '+', top: top, bottom: bottom, expected: expected, answer: undefined };
});

_subtraction.add('problem', function() {
	// what is the range for the answer?
	// choose number between range 
	var expected = Math.randomBetween( _gameData.range.min, _gameData.range.max ),
	    top = Math.randomBetween(0,Math.min(expected,_gameData.range.base)), 
	    bottom = Math.floor( expected - top );
	return { sign: '-', top: expected, bottom: top, expected: bottom, answer: undefined };
});

_multiplication.add('problem', function() {
	// what is the range for the answer?
	// choose number between range
	var expected = Math.randomBetween( _gameData.range.min, _gameData.range.max );
	var top = Math.randomBetween(0,Math.min(expected,_gameData.range.base));

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
	var expected = Math.randomBetween( _gameData.range.min, _gameData.range.max );
	var top = Math.randomBetween(0,Math.min(expected,_gameData.range.base));

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