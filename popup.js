/*
 * This script is run when the popup is opened. 
 * The user can click the "Refresh" button to 
 * get a new email or the "Next" button to get 
 * the next email in the list. It sends a message 
 * to the background script to get the email data. 
 * The email data is then displayed in the popup.
*/

function decodeMime(str) {
    return str.replace(/=\?([^?]+)\?(Q|B)\?([^?]*?)\?=/g, function (_, charset, encoding, text) {
        if (encoding === 'B') {
            text = atob(text);
        } else if (encoding === 'Q') {
            text = text.replace(/_/g, ' ').replace(/=(\w{2})/g, function (_, hex) {
                return String.fromCharCode(parseInt(hex, 16));
            });
        }
        return decodeURIComponent(escape(text));
    });
}

function atobOrOriginal(str) {
    try {
        return atob(str);
    } catch (e) {
        return str;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var refreshButton = document.getElementById('refresh');
    var nextButton = document.getElementById('next');
    var instructionsDiv = document.getElementById('instructions');
    var subjectDiv = document.getElementById('subject');
    var fromDiv = document.getElementById('from');
    var bodyDiv = document.getElementById('body');
    var reviewCountDiv = document.getElementById('reviewCount');
    var reviewCount = 0;
    var maxReviews = 10;

    refreshButton.addEventListener('click', refreshEmail);
    nextButton.addEventListener('click', refreshEmail);

    function refreshEmail() {
        var action = this.id === 'refresh' ? 'refreshEmail' : 'nextEmail';

        reviewCount = this.id === 'refresh' ? 1 : reviewCount + 1;

        // Send a message to the background script to refresh or get the next email
        chrome.runtime.sendMessage({ action: action }, function (response) {
            if (response.error) {
                // If there was an error, display it in the #email div
                emailDiv.textContent = 'Error: ' + response.error;
            } else {
                // Decode the raw data
                // Convert base64 string to byte array
                var raw = atob(response.email.raw.replace(/-/g, '+').replace(/_/g, '/'));
                var bytes = new Uint8Array(raw.length);
                for (var i = 0; i < raw.length; i++) {
                    bytes[i] = raw.charCodeAt(i);
                }

                // Decode byte array to string
                var decoded = new TextDecoder("utf-8").decode(bytes);
                
                // console.log('Raw email data:', decoded);

                // Extract the subject with regex from the entire email
                var subjectMatch = decoded.match(/^Subject: (.*?)(?=\r\n)/m);
                var subject = subjectMatch ? decodeMime(subjectMatch[1]).substring(0, 40) : 'No subject';

                // Extract the from with regex from the entire email
                var fromMatch = decoded.match(/^From:\s*((.|\n)*?)(?=\r\n)/m);
                var from = fromMatch ? fromMatch[1].trim().substring(0, 40) : 'No from';

                if (from === '' || from === undefined) {
                    from = 'No sender information detected';
                }

                // Use the snippet value from the response as the body
                var body = response.email.snippet ? response.email.snippet : 'Message body parsing unsuccessful';

                // Replace HTML entities in the body
                body = body.replace(/&#39;/g, "'");
                body = body.replace(/&quot;/g, '"');


                // Display the subject and body in the #email div
                instructionsDiv.textContent = '';
                reviewCountDiv.textContent = 'Review count: ' + reviewCount + ' of ' + maxReviews;
                fromDiv.textContent = 'From: ' + from;
                subjectDiv.textContent = 'Subject: ' + subject;
                bodyDiv.textContent = 'Body: ' + body;
            }
        });
    }
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