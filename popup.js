document.addEventListener('DOMContentLoaded', function () {
    var refreshButton = document.getElementById('refresh');
    var emailDiv = document.getElementById('email');

    refreshButton.addEventListener('click', function () {
        // Send a message to the background script to refresh the email
        chrome.runtime.sendMessage({ action: "refreshEmail" }, function (response) {
            if (response.error) {
                // If there was an error, display it in the #email div
                emailDiv.textContent = 'Error: ' + response.error;
            } else {
                // Log the raw data
                // console.log(response.email.raw);
                // Decode the raw data
                // Convert base64 string to byte array
                var raw = atob(response.email.raw.replace(/-/g, '+').replace(/_/g, '/'));
                var bytes = new Uint8Array(raw.length);
                for (var i = 0; i < raw.length; i++) {
                    bytes[i] = raw.charCodeAt(i);
                }

                // Decode byte array to string
                var decoded = new TextDecoder("utf-8").decode(bytes);
                console.log(decoded);

                // Split the email by the MIME boundary
                var parts = decoded.split('--000000000000c7173f061487243c');

                // Find the part with the body
                var bodyPart = parts.find(part => part.includes('Content-Type: text/plain'));

                // Extract the subject and body with regex
                var subjectMatch = decoded.match(/Subject: (.*)/);
                var subject = subjectMatch ? subjectMatch[1].substring(0, 40) : 'No subject';
                // Extract the body with regex
                var bodyMatch = bodyPart.match(/(?:\r\n){2}([\s\S]*)/);
                if (bodyMatch) {
                    var body = atob(bodyMatch[1]).substring(0, 40);
                } else {
                    var body = 'No body';
                }
                // Display the subject and body in the #email div
                emailDiv.textContent = 'Subject: ' + subject + '\nBody: ' + body;
            }
        });
    });
});