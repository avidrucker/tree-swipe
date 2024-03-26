let emailIds = [];
let currentIndex = -1;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "refreshEmail" || request.action === "nextEmail") {
    // Authenticate the user and get an access token
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      // Use the fetch API to make the request
      fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10', {
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
        // Get the IDs of the emails
        emailIds = data.messages.map(message => message.id);
        // Increment the current index for "nextEmail" action
        if (request.action === "nextEmail") {
          currentIndex = (currentIndex + 1) % emailIds.length;
        } else {
          currentIndex = 0;
        }
        // Get the email
        return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + emailIds[currentIndex] + '?format=raw', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Gmail API request failed with status ' + response.status);
        }
        return response.json();
      })
      .then(email => {
        // Send the email back to the popup script
        sendResponse({email: email});
      })
      .catch(error => {
        console.error('Error:', error);
        // Send an error message back to the popup script
        sendResponse({error: error.message});
      });
    });
    return true; // indicates that the response will be sent asynchronously
  }
});