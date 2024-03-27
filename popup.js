/*
 * This script is run when the popup is opened. 
 * The user can click the "Refresh" button to 
 * get a new email or the "Next" button to get 
 * the next email in the list. It sends a message 
 * to the background script to get the email data
 * as well as the current review counter and max 
 * review limit. It then updates the UI with the
 * email details and review count.
*/

document.addEventListener('DOMContentLoaded', function () {
    var refreshButton = document.getElementById('refresh');
    var nextButton = document.getElementById('next');
    // var instructionsDiv = document.getElementById('instructions');
    var subjectDiv = document.getElementById('subject');
    var fromDiv = document.getElementById('from');
    var bodyDiv = document.getElementById('body');
    var reviewCountDiv = document.getElementById('reviewCount');

    // New function to update UI based on current email data
    function updateUI(emailDetails, reviewCount, maxReviews) {
        subjectDiv.textContent = 'Subject: ' + (emailDetails.subject || 'No subject');
        fromDiv.textContent = 'From: ' + (emailDetails.from || 'No from');
        bodyDiv.textContent = 'Body: ' + (emailDetails.body || 'Message body parsing unsuccessful');
        reviewCountDiv.textContent = `Review count: ${reviewCount + 1} of ${maxReviews}`;
    }

    // Function to request and display the current email data
    function refreshEmail(action) {
        chrome.runtime.sendMessage({ action: action }, function(response) {
            if (response.error) {
                bodyDiv.textContent = 'Error: ' + response.error;
            } else {
                // Update the UI with the email details
                updateUI(response.emailDetails, response.state.currentIndex, response.state.maxReviews);
            }
        });
    }

    // Event listeners for buttons
    refreshButton.addEventListener('click', () => refreshEmail('refreshEmail'));
    nextButton.addEventListener('click', () => refreshEmail('nextEmail'));
});