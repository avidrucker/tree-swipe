/*
 * This script is run when the popup is opened. 
 * The user can click the "Refresh" button to 
 * get a new email or the "Next" button to get 
 * the next email in the list. It sends a message 
 * to the background script to get the email data. 
 * The email data is then displayed in the popup.
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

    // Initialize UI with current state
    // refreshEmail('getState');

    // Event listeners for buttons
    refreshButton.addEventListener('click', () => refreshEmail('refreshEmail'));
    nextButton.addEventListener('click', () => refreshEmail('nextEmail'));
});

/*
A detailed feature list that outlines every capability and capacity:

1. **MIME Decoding**:
   - Decodes MIME-encoded strings within emails. It supports both 'B' (Base64) and 'Q' (Quoted-Printable) encodings.

2. **Base64 Fallback Decoding**:
   - Attempts to decode a string with Base64 encoding and falls back to the original string if decoding fails, ensuring that the function gracefully handles non-Base64 encoded or corrupted data.

3. **Dynamic Content Loading Upon Document Completion**:
   - Waits for the entire HTML document to load before initializing event listeners and variables, ensuring that elements are fully accessible and manipulatable.

4. **Interactive Email Navigation**:
   - Provides "Refresh" and "Next" buttons for users to navigate through their emails. The "Refresh" button presumably reloads the current email, or loads the first email in a sequence, while the "Next" button loads the subsequent email.

5. **Review Count Tracking**:
   - Tracks and displays the number of emails reviewed during the session, starting at 1. The count increments each time the "Next" button is pressed and resets back to 1 when the "Refresh" button is pressed.
   - Displays the current review count along with a maximum review limit (e.g., "1 of 10").

6. **Error Handling**:
   - Displays an error message directly within the email content area if an error occurs during the email fetch process, ensuring that users are informed of issues without needing to consult the console or other debugging tools.

7. **Email Content Extraction and Display**:
   - Extracts and displays key email components:
     - **From**: Shows the sender's information. If not available, displays 'No from'.
     - **Subject**: Extracts the email's subject and decodes it if necessary. If not available, displays 'No subject'.
     - **Body**: Uses the snippet provided in the response as the email body. If the snippet is not available, it displays 'Message body parsing unsuccessful'. Additionally, it replaces HTML entities (specifically `&#39;` with `'`) for better readability.

8. **Character Limitation**:
   - Limits the display length of both the subject and sender information to 40 characters, ensuring that the UI remains uncluttered.

9. **Dynamic UI Updates**:
   - Updates the user interface dynamically based on the response from a background script, which is expected to fetch email details. This includes updating the review count and displaying the extracted email information (from, subject, body) in dedicated div elements.

10. **Communication with Background Script**:
    - Utilizes `chrome.runtime.sendMessage` to request email data (either the next or a refreshed email) from a background script, demonstrating inter-script communication within a Chrome extension.

This code snippet is designed to function within the context of a Chrome extension, leveraging browser-specific APIs and JavaScript to provide a user-friendly interface for reviewing email content.
*/