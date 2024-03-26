let threadIds = [];
let currentIndex = -1;
let responseSent = false;
let threadsFetched = 0;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "refreshEmail" || request.action === "nextEmail") {
    // Authenticate the user and get an access token
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      // Use the fetch API to make the request
      fetch('https://www.googleapis.com/gmail/v1/users/me/threads?q=in:inbox&maxResults=20', {
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
        if (!data.threads || data.threads.length === 0) {
          throw new Error('Unexpected response from the Gmail API');
        }
        // Get the IDs of the threads
        threadIds = data.threads.map(thread => thread.id);
        // Increment the current index for "nextEmail" action
        if (request.action === "nextEmail") {
          currentIndex = (currentIndex + 1) % threadIds.length;
        } else {
          currentIndex = 0;
        }
        return fetchThread();
      })
      .catch(error => {
        console.error('Error:', error);
        // Send an error message back to the popup script
        if (!responseSent) {
            sendResponse({error: error.message});
          }
      });

      function fetchThread() {
        if (threadsFetched >= 20) {
          throw new Error('Reached maximum number of threads to fetch');
        }
        threadsFetched++;
        return fetch('https://www.googleapis.com/gmail/v1/users/me/threads/' + threadIds[currentIndex], {
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
        .then(thread => {
          if (!thread.messages || thread.messages.length === 0) {
            // This thread has no messages, fetch the next one
            currentIndex = (currentIndex + 1) % threadIds.length;
            return fetchThread();
          } else {
            // This thread has a message, fetch the message
            return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + thread.messages[0].id + '?format=raw', {
              headers: {
                'Authorization': 'Bearer ' + token
              }
            });
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