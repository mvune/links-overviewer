chrome.runtime.onMessage.addListener(function(message) {

	if(message.text != 'show') {return;}

	const selection = message.selection;
	const host = message.pageHost;
	let imageRequest = message.imageRequest;
	const uris = getUris(selection, host);

	if(uris.size === 0) {return;}

	document.getElementById('noresults').style.display = 'none';
	document.getElementById('loading-brick').style.display = 'block';
	
	const bricksContainer = document.getElementById('bricks-container');
	const loadingbrick = document.getElementById('loading-brick');
	
	uris.forEach(function(uri) {
		const brick = createBrick(uri, imageRequest);
		bricksContainer.insertBefore(brick, loadingbrick);
	});

	const screenshots = document.getElementsByClassName('screenshot');
	const lastScreenshot = screenshots[screenshots.length - 1];
	if(lastScreenshot) {
		lastScreenshot.addEventListener('load', function() {
			document.getElementById('loading-brick').style.display = 'none';
		});
	}
});

function createBrick(uri, imageRequest) {

	let brick = document.createElement('div');
	brick.id = 'brck' + makeId();
	brick.className = 'brick';
	brick.style.display = 'none';

	let imageAnchor = document.createElement('a');
	imageAnchor.href = uri;
	imageAnchor.title = uri;

	let image = new Image();
	image.addEventListener('load', function() {
		brick.style.display = 'block';
		window.postMessage(['Please lay out again.'], window.location.origin);
	});
	image.addEventListener('error', function() {
		onRequestFailure(['Image Error', 'Image could not be loaded.']);
	});
	image.className = 'screenshot';

	let removeButton = document.createElement('div');
	removeButton.className = 'remove-button';
	removeButton.title = 'Remove brick';
	removeButton.innerHTML = '&times;';
	removeButton.addEventListener('click', function() {
		window.postMessage(['Please remove me.', this.parentNode.id], window.location.origin);
	});

	imageAnchor.appendChild(image);
	brick.appendChild(removeButton);
	brick.appendChild(imageAnchor);

	if(localStorage && localStorage.getItem(uri)) {

		image.src = localStorage.getItem(uri);
	}

	else if(uri.endsWith('.jpg') || uri.endsWith('.gif') || uri.endsWith('.png')) {

		image.src = uri;
	}

	else {

		const imgRequest = Object.assign({}, imageRequest);
		imgRequest.url = uri;

		if(uri.includes('geenstijl.nl') || uri.includes('dumpert.nl')) {

			imgRequest.scripts || (imgRequest.scripts = {});
			imgRequest.scripts.domReady || (imgRequest.scripts.domReady = []);
			imgRequest.scripts.domReady.push('if(typeof CookiesOK == "function") {CookiesOK();}');
		}

		const onRequestSuccess = function(response) {
			image.src = 'data:image/jpg;base64,' + response.content.data;
			cacheItem(uri, image.src);
		}

		const onRequestFailure = function(message) {
			image.src = 'data/layout/no-image.png';

			let errorContainer = document.createElement('div');
			errorContainer.className = 'error-container';

			let errorName = document.createElement('span');
			errorName.className = 'error-name';
			errorName.innerHTML = message[0];

			let errorMessage = document.createElement('span');
			errorMessage.className = 'error-message';
			errorMessage.innerHTML = message[1];

			errorContainer.appendChild(errorName);
			errorContainer.appendChild(errorMessage);
			brick.appendChild(errorContainer);
		}

		const imageParamString = JSON.stringify(imgRequest);
		doXHR(imageParamString, onRequestSuccess, onRequestFailure, 'json');
	}

	return brick;
}

function getUris(selection, host) {

	const uris = [];
	const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;
	const div = document.createElement('div');
	let matches;
	let anchors;

	matches = selection.replace(/&amp;/g, '&').match(urlRegex);
	if(matches) {uris.push(...matches);}
	
	div.innerHTML = selection;
	anchors = div.getElementsByTagName('a');

	for(let i = 0, len = anchors.length; i < len; i++) {

		let uri = anchors[i].getAttribute('href');
		
		if(uri && uri.startsWith('/')) {
			uris.push(host + uri);
		}
	}
	return new Set(uris);
}

function cacheItem(name, value) {

	if(!localStorage) {return;}

	try {

		localStorage.setItem(name, value);
		localStorage.setItem(new Date() / 1, name);
	} catch(e) {

		const dateKeys = [];

		for(let key in localStorage) {

			if(!isNaN(key) && key > 1) {

				dateKeys.push(key);
			}
		}

		if(dateKeys.length > 0) {
			
			const oldestKey = Math.min(...dateKeys);
			localStorage.removeItem(localStorage.getItem(oldestKey));
			localStorage.removeItem(oldestKey);
			cacheItem(name, value);

		} else {

			localStorage.clear();
		}
	}
}

function doXHR(paramString, onSuccess, onFailure, responseType) {

	const xhttp = new XMLHttpRequest();

	xhttp.onreadystatechange = function() {

		if(this.readyState == 4) {

			let ErrorMessage;

			switch(this.status) {

				case 200:
					onSuccess(this.response);
					break;
				case 400:
					ErrorMessage = ['Bad Request', 'The request has an error in it.'];
					break;
				case 401:
					ErrorMessage = ['Unauthorized', 'Invalid API key is being used.'];
					break;
				case 402:
					ErrorMessage = ['Out Of Credits', 'You\'re out of credits. Credits will refill in 1 day.'];
					break;
				case 403:
					ErrorMessage = ['Forbidden', 'Your request was flagged due to abuse.'];
					break;
				case 424:
					ErrorMessage = ['Failed Dependency', 'The target page was not reachable (the request timed out).'];
					break;
				case 500:
					ErrorMessage = ['Internal Server Error', 'The PhantomJs Cloud instance suffered an internal error.'];
					break;
				case 502:
					ErrorMessage = ['Bad Gateway', 'The request did not reach PhantomJs Cloud due to a network failure.'];
					break;
				default:
					ErrorMessage = ['Unknown Error', this.status];
			}

			if(ErrorMessage) {onFailure(ErrorMessage);}
		}
	}

	xhttp.responseType = responseType || '';
	xhttp.open('POST', 'https://phantomjscloud.com/api/browser/v2/a-demo-key-with-low-quota-per-ip-address/', true);
	xhttp.send(paramString);
}

const makeId = (function() {

	let id = 1;

	return function make() {

		return id++;
	}
})();
