document.addEventListener('DOMContentLoaded', function () {
    // review screen elements
    var quitButton = document.getElementById('quit');
    var nextButton = document.getElementById('next');
    // var instructionsDiv = document.getElementById('instructions');
    var subjectDiv = document.getElementById('subject');
    var fromDiv = document.getElementById('from');
    var bodyDiv = document.getElementById('body');
    var reviewCountDiv = document.getElementById('reviewCount');
    var msgDiv = document.getElementById('msg');
    var skipButton = document.getElementById('skip');

    // question and answer elements
    var questionDiv = document.getElementById('question');
    var noButton = document.getElementById('noBtn');
    var yesButton = document.getElementById('yesBtn');
    var applyCurrentLabelButton = document.getElementById('applyLabelBtn');
    var applyLabelAndFinishButton = document.getElementById('applyLabelsAndFinishBtn');
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
    var clearButton = document.getElementById('clearAllLabels');

    var spinner = document.getElementById('spinner');

    function getToggleState() {
        return skipToggle.checked;
    }

    function showSpinner() {
        spinner.classList.add('dib');
        spinner.classList.remove('dn');
    }

    /**
     * Updates the user interface with the provided email details, review count, and maximum reviews.
     *
     * @param {object} emailDetails - The details of the email.
     * @param {string} emailDetails.subject - The subject of the email.
     * @param {string} emailDetails.from - The sender of the email.
     * @param {string} emailDetails.body - The body of the email.
     * @param {number} reviewCount - The current review count.
     * @param {number} maxReviews - The maximum number of reviews.
     * @returns {void}
     */
    function updateUI(emailDetails, reviewCount, maxReviews) {
        // instructionsDiv.textContent = ''; // Clear the instructions
        subjectDiv.textContent = 'Subject: ' + (emailDetails.subject || 'No subject');
        fromDiv.textContent = 'From: ' + (emailDetails.from || 'No from');
        bodyDiv.textContent = 'Body: ' + (emailDetails.body || 'Message body parsing unsuccessful');
        reviewCountDiv.textContent = `Review count: ${reviewCount + 1} of ${maxReviews}`;
        msgDiv.textContent = ''; // Clear any previous messages
        setupMsg.textContent = ''; // Clear any previous messages

        // If on the last review, change the 'next' button text to 'Finish'
        // Also, toggle display of 'applyLabelAndNext' and 'applyLabelsAndFinish' buttons
        if (reviewCount + 1 === maxReviews) {
            nextButton.textContent = 'Finish';
            nextButton.title = 'Apply \'reviewed\' label, finish review session, & return to setup';
            applyCurrentLabelButton.classList.add('dn');
            applyCurrentLabelButton.classList.remove('dib');
            applyLabelAndFinishButton.classList.add('dib');
            applyLabelAndFinishButton.classList.remove('dn');
        } else {
            nextButton.textContent = 'Next';
            nextButton.title = 'Apply \'reviewed\' label & go to next thread';
            applyCurrentLabelButton.classList.add('dib');
            applyCurrentLabelButton.classList.remove('dn');
            applyLabelAndFinishButton.classList.add('dn');
            applyLabelAndFinishButton.classList.remove('dib');
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
            redoButton.classList.add('dib');
            redoButton.classList.remove('dn');
            labelBtnsDiv.classList.add('dib');
            labelBtnsDiv.classList.remove('dn');
        } else {
            yesButton.classList.add('dib');
            yesButton.classList.remove('dn');
            noButton.classList.add('dib');
            noButton.classList.remove('dn');
            redoButton.classList.add('dn');
            redoButton.classList.remove('dib');
            labelBtnsDiv.classList.add('dn');
            labelBtnsDiv.classList.remove('dib');
        }
    }


    /**
     * Updates the titles of the yes and no buttons based on the review state and whether the node is a leaf node.
     *
     * @param {boolean} isLeafNode - Indicates whether the node is a leaf node.
     * @param {Object} reviewState - The review state object containing the titles for the yes and no buttons.
     */
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
        // hide the spinner, now that a response has come back
        spinner.classList.add('dn');
        spinner.classList.remove('dib');

        if (response.error) {
            bodyDiv.textContent = 'Error: ' + response.error;
        } else {
            // displaying notifications
            if(response.type === 'notification') {
                msgDiv.textContent = response.message;
                setupMsg.textContent = response.message;
            } 
            // leaving review state
            else if (response.type === 'returnToSetup' || 
                    response.type === 'finishReview' || 
                    response.type === 'applyLabelsAndFinish') {
                // console.log("return to setup request detected");
                // Toggle the display of the sections
                setupSection.classList.remove('dn');
                reviewSection.classList.add('dn');
                reviewSection.classList.remove('flex');
                reviewSection.classList.remove('flex-column');
                reviewSection.classList.remove('justify-between');
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
                    // console.log("showing setup section");
                    // If the review data is not valid, show the setup section
                    setupSection.classList.remove('dn');
                    reviewSection.classList.add('dn');
                    reviewSection.classList.remove('flex');
                    reviewSection.classList.remove('flex-column');
                    reviewSection.classList.remove('justify-between');
                    // Change the 'next' button text back to 'Next'
                    nextButton.textContent = 'Next';
                    return; // return early when review data is not valid
                }

                // If the response is to load the state or to go to the next email, update the UI
                if(response.type === 'loadFromState' || response.type === 'nextEmail' ||
                 response.type === 'startReviewSession' || response.type === "nextQuestionNo" || 
                 response.type === "nextQuestionYes") {
                    // Toggle the display of the sections
                    // console.log("showing review section");
                    setupSection.classList.add('dn');
                    reviewSection.classList.remove('dn');
                    reviewSection.classList.add('flex');
                    reviewSection.classList.add('flex-column');
                    reviewSection.classList.add('justify-between');
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
                setupMsg.textContent = ''; // Clear any previous messages
                // Update the UI with the email details and review count
                updateUI(state.currentEmailDetails, state.reviewCount, state.maxReviews);
            }
        }
    }


    /**
     * Handles an action by sending a message to the background script.
     * @param {string} action - The action to be performed.
     */
    function handleActionWithBackground(action) {
        chrome.runtime.sendMessage({ action: action }, 
                                   responseFromBackgroundCallback);
    }


    /**
     * Sends a message to background.js to start a new review session and initialize maxReviews
     *
     * @param {number} maxReviews - The maximum number of reviews to be performed.
     * @param {boolean} skipping - Indicates whether skipping is allowed during the review session.
     */
    function startReviewSession(maxReviews, skipping) {
        chrome.runtime.sendMessage({ action: 'startReviewSession', maxReviews, skipping }, 
                                   responseFromBackgroundCallback);
    }

    // Event listeners for review buttons
    quitButton.addEventListener('click', () => handleActionWithBackground('returnToSetup'));
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
    skipButton.addEventListener('click', () => handleActionWithBackground('skipEmail'));

    // Event listeners for question buttons
    noButton.addEventListener('click', () => handleActionWithBackground('nextQuestionNo'));
    yesButton.addEventListener('click', () => handleActionWithBackground('nextQuestionYes'));
    applyCurrentLabelButton.addEventListener('click', () => handleActionWithBackground('applyLabelAndGotoNextEmail'));
    applyLabelAndFinishButton.addEventListener('click', () => {
        showSpinner();
        handleActionWithBackground('applyLabelsAndFinish');
    });
    redoButton.addEventListener('click', () => handleActionWithBackground('loadFromState')); // redoDecisionTree

    // Event listener for clear button
    clearButton.addEventListener('click', () => {
        showSpinner();
        handleActionWithBackground('clearAllLabels');
    });
    
    // Event listeners for setup buttons
    fiveButton.addEventListener('click', () => {
        startReviewSession(5, getToggleState());
        showSpinner();
    });
    tenButton.addEventListener('click', () => {
        startReviewSession(10, getToggleState());
        showSpinner();
    });
    twentyButton.addEventListener('click', () => {
        startReviewSession(20, getToggleState());
        showSpinner();
    });
    fiftyButton.addEventListener('click', () => {
        startReviewSession(50, getToggleState());
        showSpinner();
    });

    // Event listener for skipping toggle, which saves skipping value into state
    skipToggle.addEventListener('change', () => {
        chrome.runtime.sendMessage({ action: 'updateSkipping', skipping: getToggleState() }, function(response) {
            console.log("response", response);
        });
    });

    loadState();
    
});