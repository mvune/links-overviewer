chrome.runtime.onMessage.addListener(function(message) {
    if (message.text != 'show') {
        return;
    }

    const pageHost = message.pageHost;
    const selection = message.selection;
    let imageRequest = message.imageRequest;
    const uris = getUris(selection, pageHost);

    if (uris.size == 0) {
        return;
    }

    document.getElementById('no-results').style.display = 'none';
    document.getElementById('loading-brick').style.display = 'block';
    
    const bricksContainer = document.getElementById('bricks-container');
    const loadingBrick = document.getElementById('loading-brick');
    const incrementImagesLoaded = getIncrementImagesLoadedFunc(uris.size);
    
    uris.forEach(function(uri) {
        const brick = createBrick(uri, imageRequest, incrementImagesLoaded);
        bricksContainer.insertBefore(brick, loadingBrick);
    });
});

/**
 * Extracts and returns uri's from a given `selection`.
 * 
 * @param  {string} selection String to extract the uri's from.
 * @param  {string} host      The hostname which is the root of the relative uri's.
 * @return {Set} A Set containing the extracted uri's.
 */
function getUris(selection, host) {
    const uris = [];
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;
    const div = document.createElement('div');
    let matches;
    let anchors;

    matches = selection.replace(/&amp;/g, '&').match(urlRegex);
    if (matches) {
        uris.push(...matches);
    }
    
    div.innerHTML = selection;
    anchors = div.getElementsByTagName('a');
    const len = anchors.length;

    for (let i = 0; i < len; i++) {
        let uri = anchors[i].getAttribute('href');
        
        if (uri && uri.startsWith('/')) {
            uris.push(host + uri);
        }
    }

    return new Set(uris);
}

/**
 * Creates and returns a brick.
 * 
 * @param {string}   uri                   Uri of the brick.
 * @param {Object}   imageRequest          Image request parameters.
 * @param {Function} incrementImagesLoaded Function that increments the number of 
 *                                         images loaded.
 * @return {Object} Div element representing a brick.
 */
function createBrick(uri, imageRequest, incrementImagesLoaded) {
    let brick = document.createElement('div');
    brick.id = 'brck' + getUniqueId();
    brick.className = 'brick';
    brick.style.display = 'none';

    let imageAnchor = document.createElement('a');
    imageAnchor.href = uri;
    imageAnchor.title = uri;
    imageAnchor.target = '_blank';

    let image = new Image();
    image.addEventListener('load', function() {
        brick.style.display = 'block';
        window.postMessage(['Please lay out again.'], window.location.origin);
        incrementImagesLoaded();
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

    const onRequestSuccess = function(response) {
        image.src = 'data:image/jpg;base64,' + response.content.data;
        cacheItem(uri, image.src);
    }

    const onRequestFailure = function(message) {
        image.src = '/data/no-image.png';
        imageAnchor.title += '\r\n--------------------\r\n';
        imageAnchor.title += message[0] + ': ' + message[1];
    }

    if (localStorage && localStorage.getItem(uri)) {
        image.src = localStorage.getItem(uri);
    } else if (uri.endsWith('.jpg') || uri.endsWith('.gif') || uri.endsWith('.png')) {
        image.src = uri;
    } else {
        const imgRequest = Object.assign({}, imageRequest);
        imgRequest.url = uri;

        if (uri.includes('geenstijl.nl') || uri.includes('dumpert.nl')) {
            imgRequest.scripts || (imgRequest.scripts = {});
            imgRequest.scripts.domReady || (imgRequest.scripts.domReady = []);
            imgRequest.scripts.domReady.push('if (typeof CookiesOK == "function") {CookiesOK();}');
        }

        const imageParamString = JSON.stringify(imgRequest);
        doXHR(imageParamString, onRequestSuccess, onRequestFailure, 'json');
    }

    return brick;
}

/**
 * Caches a name-value pair in de browser's localStorage. If the localStorage is 
 * full, it removes items (only those that are added through this function) in 
 * order of descending age, until there is enough space for the new item.
 * 
 * @param {string} name A name for the value.
 * @param {string} value A value to be stored in cache.
 */
function cacheItem(name, value) {
    if (!localStorage) {
        return;
    }

    try {
        localStorage.setItem(name, value);
        localStorage.setItem(new Date() / 1, name);
    } catch(e) {
        const dateKeys = [];

        for (let key in localStorage) {
            if (!isNaN(key) && key > 1) {
                dateKeys.push(key);
            }
        }

        if (dateKeys.length > 0) {
            const oldestKey = Math.min(...dateKeys);
            localStorage.removeItem(localStorage.getItem(oldestKey));
            localStorage.removeItem(oldestKey);
            cacheItem(name, value);
        } else {
            localStorage.clear();
        }
    }
}

/**
 * Sends a post request to phantomjscloud.com.
 * 
 * @param {string}   Parameters to be send along.
 * @param {Function} Callback on success.
 * @param {Function} Callback on failure.
 * @param {string}   Response type.
 */
function doXHR(paramString, onSuccess, onFailure, responseType) {
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            let ErrorMessage;

            switch (this.status) {
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

            if (ErrorMessage) {
                onFailure(ErrorMessage);
            }
        }
    }

    xhttp.responseType = responseType || '';
    xhttp.open('POST', 'https://phantomjscloud.com/api/browser/v2/a-demo-key-with-low-quota-per-ip-address/', true);
    xhttp.send(paramString);
}

/**
 * Gives a unique id number.
 * 
 * @return {int} A unique id number.
 */
const getUniqueId = (function() {
    let id = 1;

    return function make() {
        return id++;
    }
})();

/**
 * Gets the incrementImagesLoaded function.
 * 
 * @param {number} all Total number of images.
 * @return {function} incrementImagesLoaded function.
 */
const getIncrementImagesLoadedFunc = function (all) {
    let loaded = 0;

    return function incrementImagesLoaded() {
        loaded++;

        if (all == loaded) {
            document.getElementById('loading-brick').style.display = 'none';
        }
    }
};
