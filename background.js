chrome.contextMenus.create({
    id: 'show-overview',
    title: 'Show selected link(s) in links overview',
    contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (!info.menuItemId == 'show-overview') {
        return;
    }

    const pageUrl = new URL(tab.url);
    const pageHost = pageUrl.protocol + '//' + pageUrl.host;

    chrome.tabs.executeScript({
        file: '/content-scripts/get-selection.js'
    }, getOrCreateTab);

    function getOrCreateTab(selection) {
        chrome.tabs.query({
            title: 'Links Overviewer'
        },
            function(result) {
                if(result[0]) {
                    chrome.tabs.update(
                        result[0].id,
                        {active: true},
                        function(tab) {
                            sendData(selection);
                        }
                    );
                } else {
                    chrome.tabs.create({
                        url: chrome.extension.getURL('data/links-overview.html')
                    },
                        function(tab) {
                            chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tabInfo) {
                                if(tabId == tab.id && changeInfo.status == 'complete') {
                                    sendData(selection);
                                }
                            });
                        }
                    );
                }
            }
        );
    }

    function sendData(selection) {
        chrome.runtime.sendMessage({
            text: 'show',
            pageHost: pageHost,
            selection: '' + selection,
            imageRequest: imageRequest
        });
    }
});
