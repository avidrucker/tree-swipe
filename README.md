# TreeSwipe Chrome Extension

TreeSwipe is a Chrome extension that allows users to read and quickly label their Gmail inbox emails using a decision tree. 

## Features

- Decide on how many email threads to review
- Display preview text of threads, one thread at a time
- Answer decision tree type questions regarding each thread
- Apply labels to threads depending on question answers

## How to Use

1. Click on the TreeSwipe icon in the Chrome toolbar.
2. Select how many threads to review
3. A preview of an email thread in your inbox will be displayed.
4. Click on the buttons to answer no, yes, apply labels, or redo
5. Repeat steps 1-4 as desired

## Permissions

This extension requires the following permissions:

- `tabs`: To interact with the browser tabs
- `storage`: To store user data
- `https://www.googleapis.com/auth/gmail.modify`: To read emails and add/remove labels from them
- `https://www.googleapis.com/auth/gmail.labels`: To manage (read and create) labels
- `identity`: To authenticate the user
- `activeTab`: To interact with the currently active tab

## Development

This extension is developed using the Chrome Extension API. The `manifest.json` file contains the metadata for the extension. The `popup.html` file is the UI for the extension, and the `popup.js` and `background.js` files contain the main logic for the extension.

Please note that accessing a user's Gmail inbox requires user consent and adherence to Google's API usage policies.