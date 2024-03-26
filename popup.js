document.addEventListener('DOMContentLoaded', function () {
    var refreshButton = document.getElementById('refresh');
    var nextButton = document.getElementById('next');
    var emailDiv = document.getElementById('email');

    refreshButton.addEventListener('click', refreshEmail);
    nextButton.addEventListener('click', refreshEmail);

    function refreshEmail() {
        var action = this.id === 'refresh' ? 'refreshEmail' : 'nextEmail';

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
                
                // Extract the subject with regex from the entire email
                var subjectMatch = decoded.match(/^Subject: (.*?)(?=\r\n)/m);
                var subject = subjectMatch ? subjectMatch[1].substring(0, 40) : 'No subject';

                // Extract the from with regex from the entire email
                var fromMatch = decoded.match(/^From: (.*?)(?=\r\n)/m);
                var from = fromMatch ? fromMatch[1].substring(0, 40) : 'No from';

                // console.log("decoded");
                // console.log(decoded);

                // Extract the MIME boundary from the headers
                var boundaryMatch = decoded.match(/boundary="(.*)"/);
                var boundary = boundaryMatch ? boundaryMatch[1] : null;

                if (boundary) {
                    // Split the email by the MIME boundary
                    var parts = decoded.split('--' + boundary);
                    var headersPart = parts[0];

                    // Extract the subject with regex from the entire email
                    var subjectMatch = headersPart.match(/^Subject: (.*?)(?=\r\n)/m);
                    var subject = subjectMatch ? subjectMatch[1].substring(0, 40) : 'No subject';

                    var fromMatch = headersPart.match(/^From: (.*?)(?=\r\n)/m);
                    var from = fromMatch ? fromMatch[1].substring(0, 40) : 'No from';

                    // Find the part with the body
                    var bodyPart = parts.find(part => part.includes('Content-Type: text/plain'));

                    // Extract the body with regex
                    var bodyMatch = bodyPart.match(/(?:\r\n){2}([\s\S]*)/);
                    var body;
                    if (bodyMatch) {
                        try {
                            // Always attempt to base64 decode the body
                            body = atob(bodyMatch[1]).substring(0, 40);
                        } catch (e) {
                            // If decoding fails, use the original body
                            body = bodyMatch[1].substring(0, 40);
                        }
                    } else {
                        body = 'No body';
                    }
                    // Display the subject and body in the #email div
                    emailDiv.textContent = 'From: ' + from + '\nSubject: ' + subject + '\nBody: ' + body;
                } else {
                    // Display the subject and body in the #email div
                    emailDiv.textContent = 'From: ' + from + '\nSubject: ' + subject + '\nBody: ' + body;
                }
            }
        });
    }
});