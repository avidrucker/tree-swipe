let messagesMetaInfo = [];
let messagesData = [];
let currentIndex = -1;
let token = null;

// sends message we have already fetched to the popup
function passMessageToClient(sendResponse) {
    // Check if messages[currentIndex] is defined
    if (messagesData[currentIndex]) {
        // Send the message data back to the popup script
        sendResponse({ email: messagesData[currentIndex] });
    } else {
        // Send an error message back to the popup script
        sendResponse({ error: 'No messages available' });
    }
}


function fetchMessageData(messageId, messageDataCallback) {
    // check if messageId already exists in messages
   
    // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get
    return fetch('https://www.googleapis.com/gmail/v1/users/me/messages/' + messageId + '?format=raw', {
        headers: {
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Gmail API request failed with status ' + response.status);
        }
        return response.json();
    }).then(data => {
        // Store the message data
        messagesData.push(data);
        // Call the callback function if it was provided
        if (messageDataCallback) {
            messageDataCallback();
        }
    });
}


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "refreshEmail") {
        // Authenticate the user and get an access token
        chrome.identity.getAuthToken({interactive: true}, function(t) {
            token = t;
            // Use the fetch API to make the request
            // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list
            fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=50', {
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Gmail API request failed with status ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                // Check if the response has the expected structure
                if (!data.messages || data.messages.length === 0) {
                    throw new Error('Unexpected response from the Gmail API');
                }
                // Group messages by thread ID
                let threads = {};
                console.log(data);
                // data has data.nextPageToken
                for (let meta of data.messages) {
                    if (!threads[meta.threadId]) {
                        threads[meta.threadId] = meta;
                    }
                }

                messagesMetaInfo = Object.values(threads);
                
                // Reset the current index for "refreshEmail" action
                currentIndex = 0;
                fetchMessageData(messagesMetaInfo[currentIndex].id, function() {
                    passMessageToClient(sendResponse);
                });
            })
            .catch(error => {
                console.error('Error:', error);
                // Send an error message back to the popup script
                sendResponse({error: error.message});
            });
        });
        return true; // indicates that the response will be sent asynchronously
    } else if (request.action === "nextEmail") {
        // debugger
        // Increment the current index for "nextEmail" action
        currentIndex = (currentIndex + 1) % messagesMetaInfo.length;
        fetchMessageData(messagesMetaInfo[currentIndex].id, function() {
            passMessageToClient(sendResponse);
        });
        return true; // indicates that the response will be sent asynchronously
    }
});