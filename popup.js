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
    var clearButton = document.getElementById('clearReviewedLabels');

    // question and answer elements
    var questionDiv = document.getElementById('question');
    var noButton = document.getElementById('noBtn');
    var yesButton = document.getElementById('yesBtn');

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
            nextButton.title = 'Finish review session, apply labels, and return back to setup';
        } else {
            nextButton.textContent = 'Next';
            nextButton.title = 'Go to the next email thread';
        }
    }

    // // Function to request and display the current state
    function loadState() {
        chrome.runtime.sendMessage({ action: 'loadFromState' }, responseFromBackgroundCallback);
    }

    
    /**
     * Handles the response received from the background script.
     * @param {Object} response - The response object from the background script.
     */
    function responseFromBackgroundCallback(response) {
        if (response.error) {
            bodyDiv.textContent = 'Error: ' + response.error;
        } else {
            // displaying notifications
            if(response.type === 'notification') {
                msgDiv.textContent = response.message;
            } 
            // leaving review state
            else if (response.type === 'returnToSetup' || response.type === 'finishReview') {
                // console.log("return to setup request detected");
                // Toggle the display of the sections
                setupSection.classList.remove('dn');
                reviewSection.classList.add('dn');
                // Change the 'next' button text back to 'Next'
                nextButton.textContent = 'Next';
            }
            // in reviewing state
             else {
                let state = response.data.state;
                if (!(state && state.currentEmailDetails && state.currentIndex !== -1 && state.maxReviews !== -1)) {
                    // If the review data is not valid, show the setup section
                    setupSection.classList.remove('dn');
                    reviewSection.classList.add('dn');
                    // console.log("review data is not valid, returning early");
                    return;
                }

                // debugger
                // console.log("response from popup.js", response);
                if(response.type === 'loadFromState' || response.type === 'nextEmail' || response.type === 'startReviewSession') {
                    // Toggle the display of the sections
                    setupSection.classList.add('dn');
                    reviewSection.classList.remove('dn');
                    console.log("response", response);
                    questionDiv.textContent = response.data.reviewState.currentQuestion;
                }
                nextButton.disabled = false;
                console.log("refreshing email data, not returning to setup");
                msgDiv.textContent = ''; // Clear any previous messages
                // Update the UI with the email details and review count
                updateUI(state.currentEmailDetails, state.currentIndex, state.maxReviews);
            }
        }
    }


    // Function to request and display the current email data
    function refreshEmail(action) {
        chrome.runtime.sendMessage({ action: action }, responseFromBackgroundCallback);
    }


    function startReviewSession(maxReviews) {
        // Send a message to background.js to start the review session and initialize maxReviews
        chrome.runtime.sendMessage({ action: 'startReviewSession', maxReviews: maxReviews }, responseFromBackgroundCallback);
    }

    // Event listeners for review buttons
    quitButton.addEventListener('click', () => refreshEmail('returnToSetup'));
    nextButton.addEventListener('click', () => {
        this.disabled = true;
        if (nextButton.textContent === 'Next') {
            refreshEmail('nextEmail');
        } else if (nextButton.textContent === 'Finish') {
            refreshEmail('finishReview');
        } else {
            console.error('Invalid button text');
        }
    });
    applyLabelButton.addEventListener('click', () => refreshEmail('applyReviewedLabel'));

    // Event listener for clear button
    clearButton.addEventListener('click', () => refreshEmail('clearReviewedLabel'));
    
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