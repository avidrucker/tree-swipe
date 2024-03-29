document.addEventListener('DOMContentLoaded', function () {
    // review screen elements
    var quitButton = document.getElementById('quit');
    var nextButton = document.getElementById('next');
    var applyCheeseButton = document.getElementById('applyCheese');
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
    var applyCurrentLabelButton = document.getElementById('applyLabelBtn');
    var redoButton = document.getElementById('redoBtn');

    // setup screen elements
    var setupSection = document.getElementById('setupSection');
    var reviewSection = document.getElementById('reviewSection');
    var fiveButton = document.getElementById('five');
    var tenButton = document.getElementById('ten');
    var twentyButton = document.getElementById('twenty');
    var fiftyButton = document.getElementById('fifty');
    var setupMsg = document.getElementById('setupMsg'); // this can be used for displaying response errors
    var skipToggle = document.getElementById('skipping');

    function getToggleState() {
        return skipToggle.checked;
    }

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

    function toggleYesNoBtns(isLeafNode) {
        if(isLeafNode) {
            yesButton.classList.add('dn');
            yesButton.classList.remove('dib');
            noButton.classList.add('dn');
            noButton.classList.remove('dib');
            applyCurrentLabelButton.classList.add('dib');
            applyCurrentLabelButton.classList.remove('dn');
            redoButton.classList.add('dib');
            redoButton.classList.remove('dn');
        } else {
            yesButton.classList.add('dib');
            yesButton.classList.remove('dn');
            noButton.classList.add('dib');
            noButton.classList.remove('dn');
            applyCurrentLabelButton.classList.add('dn');
            applyCurrentLabelButton.classList.remove('dib');
            redoButton.classList.add('dn');
            redoButton.classList.remove('dib');
        }
    }

    function updateYesNoTitles(isLeafNode, reviewState) {
        if(!isLeafNode) {
            yesButton.title = reviewState.yesBtnTitle;
            noButton.title = reviewState.noBtnTitle;
        }
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
                // update skipping input checkbox w/ state.skipping value
                // console.log("updating skipping checkbox", state.skipping);
                skipToggle.checked = state.skipping;

                if (!(state && state.currentEmailDetails && state.currentIndex !== -1 && state.maxReviews !== -1)) {
                    // If the review data is not valid, show the setup section
                    setupSection.classList.remove('dn');
                    reviewSection.classList.add('dn');
                    // Change the 'next' button text back to 'Next'
                    nextButton.textContent = 'Next';
                    return; // return early when review data is not valid
                }

                // If the response is to load the state or to go to the next email, update the UI
                if(response.type === 'loadFromState' || response.type === 'nextEmail' ||
                 response.type === 'startReviewSession' || response.type === "nextQuestionNo" || 
                 response.type === "nextQuestionYes") {
                    // Toggle the display of the sections
                    setupSection.classList.add('dn');
                    reviewSection.classList.remove('dn');
                    console.log("response", response);
                    questionDiv.textContent = response.data.reviewState.questionText;
                    questionDiv.title = response.data.reviewState.questionExplanation || '';
                    // if we are on a leaf node, we will conditionally display the 'apply label' button
                    // and 'redo decision tree' button instead of the 'yes' and 'no' buttons
                    toggleYesNoBtns(response.data.reviewState.isLeafNode);
                    updateYesNoTitles(response.data.reviewState.isLeafNode, response.data.reviewState);
                }
                nextButton.disabled = false;
                console.log("refreshing email data, not returning to setup");
                msgDiv.textContent = ''; // Clear any previous messages
                // Update the UI with the email details and review count
                updateUI(state.currentEmailDetails, state.reviewCount, state.maxReviews);
            }
        }
    }


    // Function to request and display the current email data
    function handleActionWithBackground(action) {
        chrome.runtime.sendMessage({ action: action }, 
                                   responseFromBackgroundCallback);
    }


    function startReviewSession(maxReviews, skipping) {
        // Send a message to background.js to start the review session and initialize maxReviews
        chrome.runtime.sendMessage({ action: 'startReviewSession', maxReviews, skipping }, 
                                   responseFromBackgroundCallback);
    }

    // Event listeners for review buttons
    quitButton.addEventListener('click', () => handleActionWithBackground('returnToSetup'));
    applyCheeseButton.addEventListener('click', () => handleActionWithBackground('applyCheese'));
    nextButton.addEventListener('click', () => {
        this.disabled = true;
        if (nextButton.textContent === 'Next') {
            handleActionWithBackground('nextEmail');
        } else if (nextButton.textContent === 'Finish') {
            handleActionWithBackground('finishReview');
        } else {
            console.error('Invalid button text');
        }
    });

    // Event listeners for question buttons
    noButton.addEventListener('click', () => handleActionWithBackground('nextQuestionNo'));
    yesButton.addEventListener('click', () => handleActionWithBackground('nextQuestionYes'));
    applyCurrentLabelButton.addEventListener('click', () => handleActionWithBackground('applyCurrentNodeLabel'));
    redoButton.addEventListener('click', () => handleActionWithBackground('loadFromState')); // redoDecisionTree

    // Event listener for clear button
    clearButton.addEventListener('click', () => handleActionWithBackground('clearReviewedLabel'));
    
    // Event listeners for setup buttons
    fiveButton.addEventListener('click', () => startReviewSession(5, getToggleState()));
    tenButton.addEventListener('click', () => startReviewSession(10, getToggleState()));
    twentyButton.addEventListener('click', () => startReviewSession(20, getToggleState()));
    fiftyButton.addEventListener('click', () => startReviewSession(50, getToggleState()));

    // Event listener for skipping toggle, which saves skipping value into state
    skipToggle.addEventListener('change', () => {
        chrome.runtime.sendMessage({ action: 'updateSkipping', skipping: getToggleState() }, function(response) {
            console.log("response", response);
        });
    });

    // function that sends a message to the background script to console log the state
    debugButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
            console.log("response", response);
        });
    });

    loadState();
    
});