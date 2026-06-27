// src/arena/core/tabManager.js

let currentCallback = null;
let tabsList = [];

export const tabManager = {
    init(tabs, onTabChange) {
        tabsList = tabs;
        currentCallback = onTabChange;
    },
    switchTo(tabId) {
        if (!tabsList.find(t => t.id === tabId)) return;
        if (currentCallback) currentCallback(tabId);
    },
    getTabs() {
        return [...tabsList];
    }
};