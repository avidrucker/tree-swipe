chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "refreshEmail") {
      // Authenticate the user and get an access token
      chrome.identity.getAuthToken({interactive: true}, function(token) {
        // Create a new XMLHttpRequest
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=1');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.onload = function() {
          // Parse the response
          var response = JSON.parse(xhr.responseText);
          // Get the first email
          var email = response.messages[0];
          // Send the email back to the popup script
          sendResponse({email: email});
        };
        xhr.send();
      });
      return true; // indicates that the response will be sent asynchronously
    }
  });