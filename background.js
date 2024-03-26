chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "refreshEmail") {
      // Authenticate the user and get an access token
      chrome.identity.getAuthToken({interactive: true}, function(token) {
        // Use the fetch API to make the request
        fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=1', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(response => response.json())
        .then(data => {
          // Get the first email
          var email = data.messages[0];
          // Send the email back to the popup script
          sendResponse({email: email});
        })
        .catch(error => {
          console.error('Error:', error);
        });
      });
      return true; // indicates that the response will be sent asynchronously
    }
  });