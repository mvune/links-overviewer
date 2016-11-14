window.addEventListener('load', init);
window.addEventListener('message', onMessage);

function init() {
	window.msnry = new Masonry('#bricks-container', {
	  itemSelector: '.brick',
	  percentPosition: true,
	  stagger: 50
	});
}

function onMessage(event) {
	if(event.origin !== window.location.origin) return;
	if(event.data[0] == 'Please lay out again.') layout();
	else if(event.data[0] == 'Please remove me.') remove(document.getElementById(event.data[1]));
}

function layout() {
	window.msnry.reloadItems();
	window.msnry.layout();
}

function remove(element) {
	window.msnry.remove(element);
	window.msnry.layout();
}
