let messages = [];
let currentIndex = -1;
let responseSent = false;
let messagesFetched = 0;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "refreshEmail" || request.action === "nextEmail") {
    // Authenticate the user and get an access token
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      // Use the fetch API to make the request
      fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=20', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Gmail API request failed with status ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        // Check if the response has the expected structure
        if (!data.messages || data.messages.length === 0) {
          throw new Error('Unexpected response from the Gmail API');
        }
        // Get the IDs of the messages
        messages = data.messages;
        // Group messages by thread ID
        let threads = {};
        for (let message of messages) {
          if (!threads[message.threadId]) {
            threads[message.threadId] = message;
          }
        }
        // Convert threads object to array
        messages = Object.values(threads);
        // Increment the current index for "nextEmail" action
        if (request.action === "nextEmail") {
          currentIndex = (currentIndex + 1) % messages.length;
        } else {
          currentIndex = 0;
        }
        return fetchMessage();
      })
      .catch(error => {
        console.error('Error:', error);
        // Send an error message back to the popup script
        if (!responseSent) {
            sendResponse({error: error.message});
          }
      });

      function fetchMessage() {
        if (messagesFetched >= 20) {
          throw new Error('Reached maximum number of messages to fetch');
        }
        messagesFetched++;
        return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + messages[currentIndex].id + '?format=raw', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Gmail API request failed with status ' + response.status);
          }
          return response.json();
        })
        .then(email => {
          // Send the raw email back to the popup script
          sendResponse({email: email});
          responseSent = true;
        });
      }
    });
    return true; // indicates that the response will be sent asynchronously
  }
});