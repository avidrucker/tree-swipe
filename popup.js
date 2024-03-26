document.addEventListener('DOMContentLoaded', function() {
    var refreshButton = document.getElementById('refresh');
    var emailDiv = document.getElementById('email');
  
    refreshButton.addEventListener('click', function() {
      // Send a message to the background script to refresh the email
      chrome.runtime.sendMessage({action: "refreshEmail"}, function(response) {
        // Display the email in the #email div
        emailDiv.textContent = response.email;
      });
    });
  });