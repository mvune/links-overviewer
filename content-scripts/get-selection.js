(function getSelectionHtml() {
    const selection = window.getSelection();

    if (selection.rangeCount) {
        const len = selection.rangeCount;
        const div = document.createElement('div');
        
        for (let i = 0; i < len; ++i) {
            div.appendChild(selection.getRangeAt(i).cloneContents());
        }
        
        return div.innerHTML;
    }
})();
