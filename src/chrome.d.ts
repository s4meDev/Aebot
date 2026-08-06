declare const chrome: typeof globalThis & {
  sidePanel?: {
    setOptions(options: { path: string; enabled: boolean }): void;
    open(options: { tabId: number }): Promise<void>;
  };
  runtime: {
    getManifest(): { host_permissions?: string[]; version?: string };
    onInstalled: { addListener(listener: () => void): void };
    onMessage: {
      addListener(listener: (message: any, sender: any, sendResponse: (response: any) => void) => boolean | void): void;
    };
  };
  action: {
    onClicked: { addListener(listener: (tab?: { id?: number }) => void): void };
  };
  tabs: {
    Tab: any;
  };
};
