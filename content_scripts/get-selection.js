(function getSelectionHtml() {

	const selection = window.getSelection();

	if(selection.rangeCount) {

		const div = document.createElement('div');
		
		for(let i = 0, len = selection.rangeCount; i < len; ++i) {
			
			div.appendChild(selection.getRangeAt(i).cloneContents());
		}
		
		return div.innerHTML;
	}
})();
