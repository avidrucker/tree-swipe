let token = null;
let messagesMetaInfo = [];
let currentIndex = -1;

function fetchAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({interactive: true}, token => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(token);
    });
  });
}

function fetchEmailList(token) {
    return fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=50', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(response => response.json())
    .then(data => {
      if (!data.messages || data.messages.length === 0) {
        throw new Error('No messages found');
      }
      // Group messages by thread ID, selecting only the first message in each thread
      let threads = {};
      for (let message of data.messages) {
        if (!threads[message.threadId]) {
          threads[message.threadId] = message;
        }
      }
      // Convert the threads object back into an array of messages (one per thread)
      return Object.values(threads);
    });
  }
  

function fetchEmailDetails(token, messageId) {
  return fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(response => response.json());
}

function handleMessageRequest(action, sendResponse) {
  fetchAuthToken().then(t => {
    token = t;
    if (action === "refreshEmail") {
      fetchEmailList(token).then(messages => {
        messagesMetaInfo = messages;
        currentIndex = 0;
        return fetchEmailDetails(token, messagesMetaInfo[currentIndex].id);
      })
      .then(emailDetails => sendResponse({ email: emailDetails }))
      .catch(error => sendResponse({ error: error.message }));
    } else if (action === "nextEmail") {
      currentIndex = (currentIndex + 1) % messagesMetaInfo.length;
      fetchEmailDetails(token, messagesMetaInfo[currentIndex].id)
      .then(emailDetails => sendResponse({ email: emailDetails }))
      .catch(error => sendResponse({ error: error.message }));
    }
  }).catch(error => sendResponse({ error: error.message }));
  return true; // indicates async response
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;
  if (action === "refreshEmail" || action === "nextEmail") {
    handleMessageRequest(action, sendResponse);
    return true;
  }
});
