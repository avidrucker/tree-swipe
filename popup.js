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
    // review screen elements
    var quitButton = document.getElementById('quit');
    var nextButton = document.getElementById('next');
    var applyLabelButton = document.getElementById('applyLabel');
    // var instructionsDiv = document.getElementById('instructions');
    var subjectDiv = document.getElementById('subject');
    var fromDiv = document.getElementById('from');
    var bodyDiv = document.getElementById('body');
    var reviewCountDiv = document.getElementById('reviewCount');
    var msgDiv = document.getElementById('msg');
    var debugButton = document.getElementById('debug');

    // setup screen elements
    var setupSection = document.getElementById('setupSection');
    var reviewSection = document.getElementById('reviewSection');
    var fiveButton = document.getElementById('five');
    var tenButton = document.getElementById('ten');
    var twentyButton = document.getElementById('twenty');
    var fiftyButton = document.getElementById('fifty');
    var setupMsg = document.getElementById('setupMsg');

    // New function to update reviewing UI based on current email data
    function updateUI(emailDetails, reviewCount, maxReviews) {
        // instructionsDiv.textContent = ''; // Clear the instructions
        subjectDiv.textContent = 'Subject: ' + (emailDetails.subject || 'No subject');
        fromDiv.textContent = 'From: ' + (emailDetails.from || 'No from');
        bodyDiv.textContent = 'Body: ' + (emailDetails.body || 'Message body parsing unsuccessful');
        reviewCountDiv.textContent = `Review count: ${reviewCount + 1} of ${maxReviews}`;
        msgDiv.textContent = ''; // Clear any previous messages

        // If on the last review, change the 'next' button text to 'Finish'
        if (reviewCount + 1 === maxReviews) {
            nextButton.textContent = 'Finish';
        } else {
            nextButton.textContent = 'Next';
        }
    }

    // // Function to request and display the current state
    function loadState() {
        chrome.runtime.sendMessage({ action: 'loadFromState' }, function(response) {
            if (response.error) {
                setupMsg.textContent = 'Error: ' + response.error;
                // If there's an error, show the setup section
                setupSection.classList.remove('dn');
                reviewSection.classList.add('dn');
            } else {
                let data = response.data;
                let state = data.state;
                // Check if the review data is valid
                if (state && state.currentEmailDetails && state.currentIndex !== -1 && state.maxReviews !== -1) {
                    // If the review data is valid, show the review section
                    setupSection.classList.add('dn');
                    reviewSection.classList.remove('dn');
                    // Update the UI with the state details
                    updateUI(state.currentEmailDetails, state.currentIndex, state.maxReviews);
                } else {
                    // If the review data is not valid, show the setup section
                    setupSection.classList.remove('dn');
                    reviewSection.classList.add('dn');
                }
            }
        });
    }

    // Function to request and display the current email data
    function refreshEmail(action) {
        chrome.runtime.sendMessage({ action: action }, function(response) {
            if (response.error) {
                bodyDiv.textContent = 'Error: ' + response.error;
            } else {
                if(response.type === 'applyReviewedLabel') {
                    // Display a success message if the label was applied
                    msgDiv.textContent = response.message;
                } else if (response.type === 'returnToSetup' || response.type === 'finishReview') {
                    console.log("return to setup request detected");
                    // Toggle the display of the sections
                    setupSection.classList.remove('dn');
                    reviewSection.classList.add('dn');
                    // Change the 'next' button text back to 'Next'
                    nextButton.textContent = 'Next';
                }
                 else {
                    console.log("refreshing email data, not returning to setup");
                    // Update the UI with the email details and review count
                    let data = response.data;
                    let state = data.state;
                    updateUI(data.emailDetails, state.currentIndex, state.maxReviews);
                }
            }
        });
    }

    function startReviewSession(maxReviews) {
        // Send a message to background.js to start the review session and initialize maxReviews
        chrome.runtime.sendMessage({ action: 'startReviewSession', maxReviews: maxReviews }, function(response) {
            if (response.error) {
                setupMsg.textContent = 'Error: ' + response.error;
            } else {
                // Toggle the display of the sections
                setupSection.classList.add('dn');
                reviewSection.classList.remove('dn');
                // Start the review session
                // Update the UI with the email details and review count
                let data = response.data;
                let state = data.state;
                updateUI(data.emailDetails, state.currentIndex, state.maxReviews);
            }
        });
    }

    // Event listeners for review buttons
    quitButton.addEventListener('click', () => refreshEmail('returnToSetup'));
    nextButton.addEventListener('click', () => {
        if (nextButton.textContent === 'Next') {
            refreshEmail('nextEmail');
        } else if (nextButton.textContent === 'Finish') {
            refreshEmail('finishReview');
        } else {
            console.error('Invalid button text');
        }
    });
    applyLabelButton.addEventListener('click', () => refreshEmail('applyReviewedLabel'));
    
    // Event listeners for setup buttons
    fiveButton.addEventListener('click', () => startReviewSession(5));
    tenButton.addEventListener('click', () => startReviewSession(10));
    twentyButton.addEventListener('click', () => startReviewSession(20));
    fiftyButton.addEventListener('click', () => startReviewSession(50));

    // function that sends a message to the background script to console log the state
    debugButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
            console.log("response", response);
        });
    });

    loadState();
    
});