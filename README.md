# TreeSwipe Chrome Extension

TreeSwipe is a Chrome extension that allows users to read and label their Gmail inbox emails. 

## Features

- Display the first email in the Gmail inbox
- Refresh functionality to fetch the latest email

## How to Use

1. Click on the TreeSwipe icon in the Chrome toolbar.
2. The first email in your Gmail inbox will be displayed.
3. Click the "Refresh" button to fetch the latest email.

## Permissions

This extension requires the following permissions:

- `tabs`: To interact with the browser tabs
- `storage`: To store user data
- `https://mail.google.com/`: To interact with Gmail
- `identity`: To authenticate the user
- `activeTab`: To interact with the currently active tab

## Development

This extension is developed using the Chrome Extension API. The `manifest.json` file contains the metadata for the extension. The `popup.html` file is the UI for the extension, and the `popup.js` and `background.js` files contain the main logic for the extension.

Please note that accessing a user's Gmail inbox requires user consent and adherence to Google's API usage policies.