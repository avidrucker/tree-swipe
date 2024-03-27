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

                // console.log("response", response);

                // Decode the raw data
                // Convert base64 string to byte array
                var raw = atob(response.email.raw.replace(/-/g, '+').replace(/_/g, '/'));
                var bytes = new Uint8Array(raw.length);
                for (var i = 0; i < raw.length; i++) {
                    bytes[i] = raw.charCodeAt(i);
                }

                // Decode byte array to string
                var decoded = new TextDecoder("utf-8").decode(bytes);
                
                // Extract the subject with regex from the entire email
                var subjectMatch = decoded.match(/^Subject: (.*?)(?=\r\n)/m);
                var subject = subjectMatch ? decodeMime(subjectMatch[1]).substring(0, 40) : 'No subject';

                // Extract the from with regex from the entire email
                var fromMatch = decoded.match(/^From: (.*?)(?=\r\n)/m);
                var from = fromMatch ? fromMatch[1].substring(0, 40) : 'No from';

                // Use the snippet value from the response as the body
                var body = response.email.snippet ? response.email.snippet : 'Message body parsing unsuccessful';

                // Replace HTML entities in the body
                body = body.replace(/&#39;/g, "'");

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