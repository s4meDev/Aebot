function ensureSidePanel() {
  if (chrome?.sidePanel?.setOptions) {
    chrome.sidePanel.setOptions({
      path: 'index.html',
      enabled: true,
    });
  }
}

async function openSidePanel(tab: { id?: number } | undefined) {
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.sidePanel?.open({ tabId: tab.id });
  } catch (error) {
    console.warn('Unable to open side panel', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureSidePanel();
});

chrome.action.onClicked.addListener((tab) => {
  void openSidePanel(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'status') {
    sendResponse({ ok: true, ready: true });
    return true;
  }

  return false;
});
