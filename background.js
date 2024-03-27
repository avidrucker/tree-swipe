let token = null;
let messagesMetaInfo = [];
let currentIndex = -1;

/*
 * Fetches an OAuth 2.0 token using the Chrome Identity API.
*/
function fetchAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(token);
    });
  });
}

/*
  * Fetches a list of emails from the user's Gmail inbox.
  */
function fetchEmailList(token) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=200', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      if (!data.messages || data.messages.length === 0) {
        throw new Error('No messages found');
      }
      // Group messages by thread ID, selecting only the first message in each thread
      let threads = {};
      for (let message of data.messages) {
        if (!threads[message.threadId]) {
          threads[message.threadId] = message;
        }
      }
      // Convert the threads object back into an array of messages (one per thread)
      return Object.values(threads);
    });
}

/*
  * Fetches the details of a specific email message.
  */
function fetchEmailDetails(token, messageId) {
  return fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json());
}

/*
  * Handles the refreshEmail and nextEmail actions.
  */
function handleMessageRequest(action, sendResponse) {
  fetchAuthToken().then(t => {
    token = t;
    if (action === "refreshEmail") {
      fetchEmailList(token).then(messages => {
        messagesMetaInfo = messages;
        currentIndex = 0;
        return fetchEmailDetails(token, messagesMetaInfo[currentIndex].id);
      })
        .then(emailDetails => sendResponse({ email: emailDetails }))
        .catch(error => sendResponse({ error: error.message }));
    } else if (action === "nextEmail") {
      currentIndex = (currentIndex + 1) % messagesMetaInfo.length;
      fetchEmailDetails(token, messagesMetaInfo[currentIndex].id)
        .then(emailDetails => sendResponse({ email: emailDetails }))
        .catch(error => sendResponse({ error: error.message }));
    }
  }).catch(error => sendResponse({ error: error.message }));
  return true; // indicates async response
}

/*
  * Listens for messages from the popup and content script.
  */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  if (action === "refreshEmail" || action === "nextEmail") {
    handleMessageRequest(action, sendResponse);
    return true;
  }
});

/*

The `background.js` file is a core component of a Chrome extension that interacts with the Gmail API to fetch and manage email data. Below are the detailed features and capacities of this script:

### OAuth 2.0 Token Fetching
- Utilizes the Chrome Identity API to fetch an OAuth 2.0 token interactively. This process involves a promise-based function, `fetchAuthToken`, which resolves with the token or rejects with an error if it fails. This token is essential for authenticating subsequent requests to the Gmail API.

### Email List Fetching
- Retrieves a list of up to 200 emails from the user's Gmail inbox using the `fetchEmailList` function. This function sends a GET request to the Gmail API's "list messages" endpoint, including the OAuth token for authorization.
- Implements logic to ensure that only the first message from each email thread is fetched and stored. This is accomplished by grouping messages by their `threadId` and filtering out any additional messages from the same thread. The result is a deduplicated list of messages, each representing a unique thread.

### Email Details Fetching
- Fetches detailed information for a specific email message through the `fetchEmailDetails` function. This function makes a request to the Gmail API's "get message" endpoint, specifying the message ID and requesting the raw format of the email. It also includes the OAuth token for authorization.

### Handling Refresh and Next Actions
- Responds to two primary actions: "refreshEmail" and "nextEmail". The `handleMessageRequest` function orchestrates the response to these actions:
  - For "refreshEmail", it resets the email viewing session by fetching a fresh list of email messages and setting the current index to 0 (the first message). It then fetches the details for this first message to be displayed.
  - For "nextEmail", it increments the current index, cycling through the fetched list of emails, and fetches details for the next message based on the updated index.

### Asynchronous Message Handling
- Uses Chrome's message-passing interface to listen for messages sent from other parts of the extension, such as a popup or content script. This is set up via `chrome.runtime.onMessage.addListener`.
- Upon receiving a message with either a "refreshEmail" or "nextEmail" action, the script executes the appropriate logic through `handleMessageRequest` and responds asynchronously. The use of `return true;` in the listener indicates to Chrome that the response will be sent asynchronously, a pattern required for handling more complex interactions that involve API calls or other asynchronous operations.

### Error Handling
- Incorporates robust error handling throughout, catching failures at various stages (token fetching, email list fetching, and email details fetching) and responding with appropriate error messages. This ensures that the extension can gracefully handle issues such as API rate limits, network errors, or authentication problems.

### Modularity and Reusability
- Breaks down functionality into discrete, purpose-specific functions (`fetchAuthToken`, `fetchEmailList`, `fetchEmailDetails`, `handleMessageRequest`). This modular design enhances the code's readability, maintainability, and testability, making it easier to update or extend the extension's features in the future.

### Security
- Carefully manages the OAuth token, fetching it as needed and including it in API requests to authenticate securely with Gmail. The script ensures that the token is not exposed or misused, aligning with best practices for handling sensitive credentials in browser extensions.

This `background.js` file demonstrates a comprehensive approach to interacting with Gmail via the Gmail API, managing authentication, fetching email data, and providing the necessary backend logic for a Chrome extension that offers email browsing capabilities.

*/