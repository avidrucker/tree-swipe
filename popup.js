document.addEventListener('DOMContentLoaded', function() {
    var refreshButton = document.getElementById('refresh');
    var emailDiv = document.getElementById('email');
  
    refreshButton.addEventListener('click', function() {
      // Send a message to the background script to refresh the email
      chrome.runtime.sendMessage({action: "refreshEmail"}, function(response) {
        // Get the email's raw data
        var raw = atob(response.email.raw.replace(/-/g, '+').replace(/_/g, '/'));
        // Parse the raw data
        var email = new window.Email(raw);
        // Get the first 40 characters of the subject and body
        var subject = email.subject.substring(0, 40);
        var body = email.body.substring(0, 40);
        // Display the subject and body in the #email div
        emailDiv.textContent = 'Subject: ' + subject + '\nBody: ' + body;
      });
    });
  });