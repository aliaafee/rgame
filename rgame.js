

class rVector2d {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	setVal(x, y) {
		this.x = x;
		this.y = y;
	}

	copyFrom(vector) {
		this.x = vector.x;
		this.y = vector.y;
	}

	isnull() {
		if (this.x == 0 && this.y == 0) {
			return true;
		}
		return false;
	}

	add(v) {
		this.x += v.x;
		this.y += v.y;
	}

	sub(v) {
		this.x -= v.x;
		this.y -= v.y;
	}

	mul(factor) {
		this.x *= factor;
		this.y *= factor;
	}
}


function rVec(x, y) {
	//Helper function to make 2d vectors
	return new rVector2d(x, y);
}


function getAbsolutePosition(element) {
	var r = rVec(element.offsetLeft, element.offsetTop);
	if (element.offsetParent) {
		var tmp = this.getAbsolutePosition(element.offsetParent);
		r.add(tmp);
	}
	r.x -= element.scrollLeft;
	r.y -= element.scrollTop;
	return r;
}


function pointInBox(point, boxPosition, width, height) {
	if (point.x >= boxPosition.x && point.x <= (boxPosition.x + width)) {
		if (point.y >= boxPosition.y && point.y <= (boxPosition.y + height)) {
			return true;
		}
	}
	return false;
}



class rAsset {
	constructor(name) {
		this.name = name;

		this.onLoadCallBack = null;
	}

	setOnLoadCallBack(onLoadCallBack) {
		this.onLoadCallBack = onLoadCallBack;
	}

	load() {
		//Override here to load the asset and when done
		//call this.onLoadCallBack
	}
}


class rSound extends rAsset {
	constructor(name, soundsrc, audioContext) {
		super(name);
		
		this.soundsrc = soundsrc;
		this.soundBuffer = null;
		this.audioContext = audioContext;
	}

	onRequestLoad() {
		this.audioContext.decodeAudioData(
			this.request.response, this.onDecodeDone.bind(this));
	}

	onDecodeDone(buffer) {
		this.soundBuffer = buffer;
		if (this.onLoadCallBack != null) {
			this.onLoadCallBack();
		}
	}

	load() {
		this.request = new XMLHttpRequest();
		this.request.open('GET', this.soundsrc, true);
		this.request.responseType = 'arraybuffer';
		this.request.onload = this.onRequestLoad.bind(this);
		this.request.send();
	}

	play(time) {
		if (typeof time == "undefined") {
			time = 0;
		}
		
		var source = this.audioContext.createBufferSource();
		source.buffer = this.soundBuffer;
		source.connect(this.audioContext.destination);
		source.start(time);
	}
}


class rImageSet extends rAsset {
	constructor(name, imagesrc) {
		super(name);

		this.imagesrc = imagesrc;

		this.image = new Image();
		this.sequences = [];
	}

	load() {
		if (this.onLoadCallBack != null) {
			this.image.onload = this.onLoadCallBack;
		}
		this.image.src = this.imagesrc;
	}

	addSequence(name, pw, ph, positionList) {
		//positionList as a list of [x,y] coordinates
		//w is cellWidth, h is cellHeight
		this.sequences[name] = {
			w : pw,
			h : ph,
			list : positionList
		}
	}

	generateSequence(name, startPosition, cellWidth, cellHeight, cellsX, cellsY) {
		if (typeof cellsY == "undefined") {
			cellsY = 1;
		}

		var positionList = []

		for (var y = 0; y <cellsY; y++) {
			for (var x = 0; x < cellsX; x++) {
				positionList.push(
					[startPosition.x + (x * cellWidth), startPosition.y + (y * cellHeight)]);
			}
		}

		this.addSequence(name, cellWidth, cellHeight, positionList);
	}

	sequenceLength(name) {
		return(this.sequences[name].list.length);
	}

	sequenceCellWidth(name) {
		return(this.sequences[name].w);
	}

	sequenceCellHeight(name) {
		return(this.sequences[name].h);
	}

	render(context, name, frame, dx, dy, dw, dh) {
		var sx = this.sequences[name].list[frame][0];
		var sy = this.sequences[name].list[frame][1];

		context.drawImage(this.image, 
			sx, sy,
			this.sequences[name].w, 
			this.sequences[name].h,
			dx, dy, dw, dh);
	}

}


class rGameLoop {
	constructor(tickLength, 
				animateCallback, 
				clearCallBack, renderCallback, 
				logCallBack) {

		if (typeof logCallBack == "undefined") {
			logCallBack = function () {};
		}

		this.tickLength = tickLength;
		this.animateCallback = animateCallback;
		this.clearCallBack = clearCallBack;
		this.renderCallback = renderCallback;
		this.logCallBack = logCallBack;

		this.stopLoop = null;
	}

	loop(timeStamp) {
		this.stopLoop = window.requestAnimationFrame(this.loop.bind(this));

		//Calculate fps
		var dt = timeStamp - this.lastRender;
		if (dt == 0) {
			this.logCallBack("0 fps");
		} else {
			this.logCallBack(Math.round(1/(dt)*1000)+"fps");
		}
		
		var nextTick = this.lastTick + this.tickLength;
		var numTicks = 0;

		if (timeStamp > nextTick) {
			var timeSinceTick = timeStamp - this.lastTick;
			numTicks = Math.floor(timeSinceTick / this.tickLength);
			for (var i = 0; i < numTicks; i++) {
				this.lastTick = this.lastTick + this.tickLength;
				this.animateCallback(timeStamp);
			}
		}
		
		this.clearCallBack(timeStamp);
		this.renderCallback(timeStamp);
		this.lastRender = timeStamp + 0;
	}

	start() {
		this.lastTick = 0;
		this.lastRender = this.lastTick;
		this.loop(performance.now());
	}

	stop() {
		window.cancelAnimationFrame(this.stopLoop)
	}
}


class rAssetLoader {
	constructor(assets, onDone, clearCallback, renderCallback) {
		if (typeof clearCallback == "undefined") {
			clearCallback = function () {};
		}
		if (typeof renderCallback == "undefined") {
			renderCallback = function () {};
		}

		this.assets = assets;
		this.onDone = onDone;
		this.clearCallBack = clearCallback;
		this.renderCallback = renderCallback;

		this.assetsLoading = 0;
		this.totalAssets = 0;
		this.progress = 0;

		this.loadLoop = new rGameLoop(25,
			this.check.bind(this),
			this.clear.bind(this),
			this.render.bind(this));
	}

	startLoadingAsset() {
		this.assetsLoading += 1;
	}

	doneLoadingAsset() {
		this.assetsLoading -= 1;
	}

	check() {
		if (this.assetsLoading == 0) {
			this.loadLoop.stop();
			this.onDone();
		}
	}

	clear(timeStamp) {
		this.clearCallBack(timeStamp);
	}

	render(timeStamp) {
		if (this.assetsLoading == 0) {
			return;
		}
		
		this.progress = Math.round(
			(this.totalAssets - this.assetsLoading)/this.totalAssets*100);

		this.renderCallback(timeStamp, this.progress);
	}

	start() {
		this.totalAssets = 0;
		for (var assetName in this.assets) {
			this.assets[assetName].setOnLoadCallBack(
				this.doneLoadingAsset.bind(this));
			this.startLoadingAsset();
			this.assets[assetName].load();
			this.totalAssets += 1;
		}

		this.loadLoop.start();
	}

}


class rGame {
	constructor(name, canvas, audioContext) {
		this.name = name;
		this.canvas = canvas;
		this.canvasContext = this.canvas.getContext("2d");
		this.audioContext = audioContext;

		this.assets = [];
		this.assetsLoading = 0;

		this.windows = [];
		this.currentWindow = null;

		this.logMessage = "";

		this.mainLoop = new rGameLoop(25, 
			this.animate.bind(this),
			this.clear.bind(this),
			this.render.bind(this),
			this.log.bind(this));

		this.paused = false;
	}

	addWindow(window) {
		this.windows[window.name] = window;
	}

	setLocation(name) {
		if (this.currentWindow != null) {
			this.currentWindow.deInitialize();
		}

		this.currentWindow = null;
		for (var windowName in this.windows) {
			if (windowName == name) {
				this.currentWindow = this.windows[windowName];
				this.currentWindow.initialize(this.canvas);
			}
		}
	}

	addAsset(asset) {
		this.assets[asset.name] = asset;
	}

	
	loadAssets(onDone) {
		this.assetLoader = new rAssetLoader(this.assets, onDone, 
			this.clearLoadScreen.bind(this), this.renderLoadScreen.bind(this));
		this.assetLoader.start();
	}

	log(message) {
		this.logMessage = message;
	}

	start() {
		this.addAssets();
		this.loadAssets(this.startGameLoop.bind(this));
	}

	startGameLoop() {
		this.setupGame();
		this.mainLoop.start();
	}

	pauseGame() {
		this.paused = true;
	}

	resumeGame() {
		this.paused = false;
		this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	addAssets() {
		//Load assets here, use the addAsset function to add an asset
	}

	setupGame() {
		//Override to setup the game, this will be called after all the assets
		//have been loaded, eg: generate backgrounds here
	}

	clearLoadScreen(timeStamp) {
		//clear the load screen
	}

	renderLoadScreen(timeStamp, progress) {
		//render load screen, progess is in % of total number of assets
	}

	animatePauseSreen(timeStamp) {

	}

	clearPauseSreen(timeStamp) {
	
	}

	renderPauseSreen(timeStamp) {
		this.canvasContext.fillStyle = "#AAAAAA";
		this.canvasContext.fillRect(this.canvas.width/2-50 , this.canvas.height/2-14 , 100, 28);
		this.canvasContext.fillStyle = "#FFFFFF"
		this.canvasContext.font = "14px Arial";
		this.canvasContext.fillText("Game Paused", this.canvas.width/2-50 + 4, this.canvas.height/2-14+20)	
	}

	animate(timeStamp) {
		if (this.paused) {
			this.animatePauseSreen(timeStamp);

			return;
		}
		
		//Animate world
		this.currentWindow.animate(timeStamp);
	}

	clear(timeStamp) {
		if (this.paused) {
			this.clearPauseSreen(timeStamp);

			return;
		}

		//Clear World here
		this.currentWindow.clear(this.canvasContext, timeStamp);
	}

	render(timeStamp) {
		if (this.paused) {
			this.renderPauseSreen(timeStamp);

			return;
		}

		//Render world backgroud

		//Render rooms
		this.currentWindow.render(this.canvasContext, timeStamp);

		//Render world forground
		this.canvasContext.fillStyle = "#AAAAAA";
		this.canvasContext.fillRect(0 ,0 , 50, 13);
		this.canvasContext.fillStyle = "#000000"
		this.canvasContext.font = "10px Arial";
		this.canvasContext.textAlign = "left";
		this.canvasContext.fillText(this.logMessage, 3, 10);
	}
}


class rWindow {
	constructor(name, width, height) {
		this.name = name;
		this.width = width;
		this.height = height;

		this.objects = [];

		this.buttons = null;

		this.background = null;

		this.eventListeners = [];
	}

	initialize(canvas) {
		this.addEventListeners(canvas);
		this.setBackground(canvas);
		var canvasContext = canvas.getContext("2d");
		canvasContext.clearRect(0, 0, canvas.width, canvas.height);
	}

	deInitialize(canvas) {
		this.removeEventListeners();
	}

	addEventListener(eventName, callBack) {
		this.eventListeners.push([eventName, callBack]);
	}

	addEventListeners(canvas) {
		for (var i in this.eventListeners) {
			window.addEventListener(
				this.eventListeners[i][0], 
				this.eventListeners[i][1]);
		}
	}

	removeEventListeners() {
		for (var i in this.eventListeners) {
			window.removeEventListener(
				this.eventListeners[i][0], 
				this.eventListeners[i][1]);
		}	
	}

	addObject(object) {
		this.objects[object.name] = object;
	}

	addButton(button) {
		if (this.buttons == null) {
			this.buttons = [];
			this.addEventListener('mouseup', this.buttonMouseUpEvent.bind(this));
			//this.addEventListener('mousemove', this.buttonMouseMoveEvent.bind(this));
		}

		this.buttons[button.name] = button;
	}

	buttonMouseUpEvent(event) {
		var absoultePosition = getAbsolutePosition(event.srcElement);
		var localMouse = rVec(event.clientX - absoultePosition.x,
								event.clientY - absoultePosition.y);

		for (var buttonName in this.buttons) {
			if (this.buttons[buttonName].onMouseUp(localMouse)) {
				return;			
			}
		}
	}

	/*
	buttonMouseMoveEvent(event) {
		var absoultePosition = getAbsolutePosition(event.srcElement);
		var localMouse = rVec(event.clientX - absoultePosition.x,
								event.clientY - absoultePosition.y);

		for (var buttonName in this.buttons) {
			if (this.buttons[buttonName].onMouseMove(localMouse)) {
				return;			
			}
		}
	}
	*/

	getBackgroundContext() {
		if (this.background == null) {
			this.background = document.createElement('canvas');
			this.background.width = this.width;
			this.background.height = this.height;
		}
		return(this.background.getContext('2d'));
	}

	setBackground(canvas) {
		if (this.background != null) {
			var base64 = this.background.toDataURL();
			canvas.style.backgroundImage = "url("+base64+")";
		} else {
			canvas.style.backgroundImage = "";
		}
	}

	animate(timeStamp) {
		//Animate rooms
		for (var objectName in this.objects) {
			this.objects[objectName].animate(timeStamp);
		}

		if (this.buttons == null) { return; }
		for (var buttonName in this.buttons) {
			this.buttons[buttonName].animate(timeStamp);
		}
	}

	clear(context, timeStamp) {
		//Clear room here
		for (var objectName in this.objects) {
			this.objects[objectName].clear(context, timeStamp);
		}

		if (this.buttons == null) { return; }
		for (var buttonName in this.buttons) {
			this.buttons[buttonName].clear(context, timeStamp);
		}
	}

	render(context, timeStamp) {
		//Render backgroud

		//Render objects
		for (var objectName in this.objects) {
			this.objects[objectName].render(context, timeStamp);
		}

		//Render forground
		if (this.buttons == null) { return; }
		for (var buttonName in this.buttons) {
			this.buttons[buttonName].render(context, timeStamp);
		}
	}
}


class rMenuItem {
	constructor(label, callBack, width, height) {
		if (typeof width == "undefined") {
			width = 100;
		}
		if (typeof height == "undefined") {
			height = 28;
		}

		this.label = label;
		this.callBack = callBack;
		this.width = width;
		this.height = height;
	}

	renderActive (context) {
		context.fillStyle = "#000000";
		context.fillRect(0, 0 , this.width, this.height);
		context.fillStyle = "#FFFFFF"
		context.font = "14px Arial";
		context.textAlign = "center";
		context.fillText(this.label, this.width/2, 20);
	}

	renderInactive(context) {
		context.fillStyle = "#FFFFFF";
		context.fillRect(0, 0 , this.width, 28);
		context.fillStyle = "#000000"
		context.font = "14px Arial";
		context.textAlign = "center";
		context.fillText(this.label, this.width/2, 20)
	}
}


class rMenu extends rWindow {
	constructor(name, width, height, position) {
		super(name, width, height);

		this.startPosition = rVec(0,0);
		this.startPosition.copyFrom(position);

		this.menuItems = [];
		this.selected = 0;

		this.addEventListener('keyup', this.keyUpEvent.bind(this));
		this.addEventListener('mouseup', this.mouseUpEvent.bind(this));
		this.addEventListener('mousemove', this.mouseMoveEvent.bind(this));
	}

	addMenuItem(menuItem) {
		this.menuItems.push(menuItem);
	}

	selectNext() {
		this.selected += 1;
		if (this.selected > (this.menuItems.length-1)) {
			this.selected = this.menuItems.length-1;
		}
	}

	selectPrevious() {
		this.selected -= 1;
		if (this.selected < 0) {
			this.selected = 0;
		}
	}

	runSelected() {
		this.menuItems[this.selected].callBack();
	}

	mouseUpEvent(event) {
		var absoultePosition = getAbsolutePosition(event.srcElement);
		var localMouse = rVec(event.clientX - absoultePosition.x,
								event.clientY - absoultePosition.y)
		var position = rVec(0,0);
		position.copyFrom(this.startPosition);

		for (var i = 0; i < this.menuItems.length; i++) {
			if (pointInBox(localMouse,
					position, 
					this.menuItems[i].width,
					this.menuItems[i].height)) {
				console.log("Clicked "+this.menuItems[i].label);
				this.selected = i;
				this.runSelected();
				return;
			}
			position.y += this.menuItems[i].height;
		}
		//console.log(localX+","+localY);
	}

	mouseMoveEvent(event) {
		var absoultePosition = getAbsolutePosition(event.srcElement);
		var localMouse = rVec(event.clientX - absoultePosition.x,
								event.clientY - absoultePosition.y)
		var position = rVec(0,0);
		position.copyFrom(this.startPosition);

		for (var i = 0; i < this.menuItems.length; i++) {
			if (pointInBox(localMouse,
					position, 
					this.menuItems[i].width,
					this.menuItems[i].height)) {
				this.selected = i;
				return;
			}
			position.y += this.menuItems[i].height;
		}
	}

	keyUpEvent(event) {
		var key = event.which;
		if (key == '38') {
			// up arrow
			this.selectPrevious();
		}
		if (key == '40') {
			// down arrow
			this.selectNext();
		}
		if (key == "13") {
			// enter key
			this.runSelected();
		}
	}

	render(context, timeStamp) {
		super.render(context, timeStamp);
		
		var position = rVec(0,0);
		position.copyFrom(this.startPosition);

		for (var i = 0; i < this.menuItems.length; i++) {
			context.save();
			context.translate(position.x, position.y);
			if (i == this.selected) {
				this.menuItems[i].renderActive(context);
			} else {
				this.menuItems[i].renderInactive(context);
			}
			context.restore();
			position.y += this.menuItems[i].height;
		}
	}
}


class rObject {
	constructor(name, position, size, angle) {
		this.name = name;
		this.position = position;
		this.size = size;
		this.angle = angle;
		this.moved = false;

		this.pPosition = rVec(0,0);
		this.pSize = rVec(0,0);

		this.pPosition.copyFrom(this.position);
		this.pSize.copyFrom(this.size);
		this.pAngle = this.angle;
	}

	animate(timeStamp) {
		this.pPosition.copyFrom(this.position);
		this.pSize.copyFrom(this.size);
		this.pAngle = this.angle;
		//animate the object 
	}

	startTransform(context) {
		context.save();
		context.translate(this.position.x, this.position.y)
		context.rotate(this.angle)
	}

	endTransform(context) {
		context.restore();
	}

	startPTransform(context) {
		context.save();
		context.translate(this.pPosition.x, this.pPosition.y);
		context.rotate(this.pAngle);
	}

	endPTransform(context) {
		context.restore();
	}

	clear(context, timeStamp) {
		//override here to Clear object in world space

		this.startPTransform(context);
		this.clearObjectSpace(context, timeStamp);
		this.endPTransform(context)
	}

	render(context, timeStamp) {
		//override here to Render object in world space
		
		this.startTransform(context);
		this.renderObjectSpace(context, timeStamp);
		this.endTransform(context)
	}

	clearObjectSpace(context, timeStamp) {
		//override this to clear in object space
		context.clearRect(
			this.size.x/2*-1 ,this.size.y/2*-1 , 
			this.size.x, this.size.y);
	}

	renderObjectSpace(context, timeStamp) {
		//override this to Render in object space
		context.fillStyle = "#00AAAA";
		context.fillRect(
			this.size.x/2*-1 ,this.size.y/2*-1 , 
			this.size.x, this.size.y);
	}
}


class rText extends rObject {
	constructor(name, position, angle, text, fillStyle, font) {
		super(name, position, rVec(1,1), angle);
		this.text = text;
		this.font = font;
		this.fillStyle = fillStyle;
	}

	clearObjectSpace(context, timeStamp) {
		context.font = this.font;
		var height = context.measureText("M").width;
		var width = context.measureText(this.text).width;
		console.log(width);
		context.clearRect(0, height * -1, width, height * 1.2);
	}

	renderObjectSpace(context, timeStamp) {
		//override this to Render in object space
		context.fillStyle = this.fillStyle;
		context.font = this.font;
		context.textAlign = "left";
		context.fillText(this.text,0,0);
	}
}


class rButton extends rObject {
	constructor(name, position, size, label, callBack, alpha) {
		if (typeof alpha == "undefined") { alpha = 0.5; }

		super(name, position, size, 0);
		
		this.label = label;
		this.callBack = callBack;
		this.alpha = alpha;
		this.hover = false;
	}

	onMouseUp(point) {
		if (pointInBox(point, this.position, this.size.x, this.size.y)) {
			this.callBack();
			return true;
		}
		return false;
	}

	onMouseMove(point) {
		if (pointInBox(point, this.position, this.size.x, this.size.y)) {
			this.hover = true;
			return true;
		}
		this.hover = false;
		return false;
	}

	renderActive (context) {
		context.fillStyle = "#000000";
		context.fillRect(this.position.x, this.position.y , this.size.x, this.size.y);
		context.fillStyle = "#FFFFFF"
		context.font = "14px Arial";
		context.textAlign = "center";
		context.fillText(this.label, this.position.x + this.size.x/2, this.position.y+ 14);
	}

	renderInactive(context) {
		context.fillStyle = "#FFFFFF";
		context.fillRect(this.position.x, this.position.y , this.size.x, this.size.y);
		context.fillStyle = "#000000"
		context.font = "14px Arial";
		context.textAlign = "center";
		context.fillText(this.label, this.position.x + this.size.x/2, this.position.y+ 14);
	}

	render(context) {
		context.save();
		context.globalAlpha = this.alpha;
		if (this.hover) {
			this.renderActive(context);
		} else {
			this.renderInactive(context);
		}
		context.restore();
	}

	clear(context) {
		context.clearRect(this.position.x, this.position.y , this.size.x, this.size.y);
	}
}


class rAnimatedObject extends rObject {
	constructor(name, position, size, angle, imageset, defaultSequence, frameInterval) {
		super(name, position, size, angle);
		this.imageset = imageset;
		this.sequenceName = defaultSequence;
		this.frameInterval = frameInterval;

		this.frame = 0;
		this.lastTick = 0;
	}

	setImageSequence(name) {
		this.sequenceName = name;
	}

	timeToSwitch(timeStamp) {
		var diffTick = timeStamp - this.lastTick;
		if (diffTick > this.frameInterval) {
			this.lastTick = timeStamp;
			return true;
		}
		return false;
	}

	resetAnimation() {
		this.frame = 0;
	}

	animate(timeStamp) {
		super.animate(timeStamp);

		var frames = this.imageset.sequenceLength(this.sequenceName);
		if (frames == 1) return
		if (this.timeToSwitch(timeStamp)) {
			this.frame += 1;
			if (this.frame > frames-1) {
				this.frame = 0;
			}
		}
	}

	clearObjectSpace(context, timeStamp) {
		context.clearRect(0, 0, this.size.x, this.size.y);
	}

	renderObjectSpace(context, timeStamp) {
		if (this.frame > this.imageset.sequenceLength(this.sequenceName)-1) {
			this.frame = (this.imageset.sequenceLength(this.sequenceName)-1) % this.frame;
		}

		this.imageset.render(context, 
			this.sequenceName, this.frame, 0, 0, this.size.x, this.size.y);
	}
}


class rActor extends rAnimatedObject {
	constructor(name, position, size, angle, imageset, frameInterval) {
		//expects the following spriteSequences in the sprite
		//go-right, go-left, go-up, go-down, face-right, 
		//face-left, face-up, face-down,

		super(name, position, size, angle, imageset, "face-down", frameInterval);
		
		this.speed = rVec(0,0);
		this.direction = 'down';
		this.walkSpeed = 0.5;
	}

	animate(timeStamp) {
		super.animate(timeStamp);
		
		this.position.add(this.speed);

		if (this.speed.isnull()) {
			this.sequenceName = "face";
		} else {
			this.sequenceName = "go";
		}

		this.sequenceName += "-" + this.direction;
	}

	setSpeed(speed) {
		this.walkSpeed = speed;
	}

	goRight() {
		this.speed.setVal(this.walkSpeed, 0);
		this.direction = 'right';
	}

	goLeft() {
		this.speed.setVal(-1 * this.walkSpeed,0);
		this.direction = 'left';
	}

	goUp() {
		this.speed.setVal(0,-1 * this.walkSpeed);
		this.direction = 'up';
	}

	goDown() {
		this.speed.setVal(0, this.walkSpeed);
		this.direction = 'down';
	}

	stop() {
		this.speed.setVal(0,0);
	}

}

