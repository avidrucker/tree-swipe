// import everything from treeswipe.js
let ts;
importScripts("treeswipe.js");

const MIN_EXPIRATION_TIME = 50;
const SEC_PER_MIN = 60;
const MILLIS_PER_SEC = 1000;
const TOKEN_EXPIRATION_TIME = MIN_EXPIRATION_TIME * SEC_PER_MIN * MILLIS_PER_SEC;

const initialState = {
  token: null,
  allLabels: [],
  tokenMadeTime: -1,
  currentEmailDetails: null,
  skipping: null,
  messagesMetaInfo: [],
  // map of ids to label array of labels to be applied to the thread
  idsAndTheirPendinglabels: {
    // id: [label1, label2]
  },
  currentIndex: -1,
  reviewCount: -1,
  maxReviews: -1
};

const initialReviewState = { currentQuestion: ts.INIT_NODE, 
                             questionText: ts.getNodeText(ts.INIT_NODE),
                             questionExplanation: ts.getQexplanation(ts.INIT_NODE),
                             isLeafNode: ts.isLeafNode(ts.INIT_NODE),
                             yesBtnTitle: ts.getNodeText(ts.getNextQ(ts.INIT_NODE, "yes")),
                             noBtnTitle: ts.getNodeText(ts.getNextQ(ts.INIT_NODE, "no"))};

let reviewState = {...initialReviewState};

function resetReviewState() {
  reviewState = {...initialReviewState};
}

// Initialize global state
let state = {...initialState};

// Load the state when the background script loads
chrome.storage.local.get(['state'], function(result) {
  if (result.state) {
    state = result.state;
    // Update the UI appropriately with the loaded state
  } else {
    state = {...initialState};
  }
});


const saveStateDefaultCallback = () => {};


// A function to save the current state
function saveState(callback = saveStateDefaultCallback) {
  chrome.storage.local.set({ state }, callback);
}

function resetState(callback = saveStateDefaultCallback) {
  state = {...initialState};
  chrome.storage.local.set({ state }, callback);
}


/**
 * Decodes a MIME-encoded string.
 * @param {string} str - The MIME-encoded string to decode.
 * @returns {string} The decoded string.
 */
function decodeMime(str) {
  return str.replace(/=\?([^?]+)\?(Q|B)\?([^?]*?)\?=/gi, function (_, charset, encoding, encodedText) {
    let buffer;
    if (encoding.toUpperCase() === 'B') {
      buffer = atob(encodedText);
    } else if (encoding.toUpperCase() === 'Q') {
      // Replace underscore with spaces as per RFC 2047 Section 4.2.2 for 'Q' encoding
      encodedText = encodedText.replace(/_/g, ' ');
      // Decode quoted-printable encoding
      buffer = encodedText.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } else {
      return encodedText; // Unrecognized encoding
    }
    try {
      // Try decoding as UTF-8 if possible
      return decodeURIComponent(escape(buffer));
    } catch (e) {
      // Fallback for characters not correctly encoded as UTF-8
      return unescape(buffer);
    }
  });
}


/**
 * Decodes a base64 encoded string using the `atob` function, or returns the original string if decoding fails.
 *
 * @param {string} str - The base64 encoded string to decode.
 * @returns {string} - The decoded string, or the original string if decoding fails.
 */
function atobOrOriginal(str) {
  try {
    return atob(str);
  } catch (e) {
    return str;
  }
}


function isTokenExpired(oldTokenMadeTime) {
  if(oldTokenMadeTime === -1 || oldTokenMadeTime === null || oldTokenMadeTime === undefined) {
    // console.log("token has never been made before, returning true");
    return true;
  }
  // gets the current time
  const currentTime = Date.now();
  // console.log("isTokenExpired will return", (currentTime - oldTokenMadeTime) > TOKEN_EXPIRATION_TIME, "for token made at ", oldTokenMadeTime, "and current time ", currentTime, " which the difference ", (currentTime - oldTokenMadeTime) , " is greater than ", TOKEN_EXPIRATION_TIME);
  // compares the current time to the time the token was made,
  // if the difference is greater than 50 minutes, we consider the token expired
  return (currentTime - oldTokenMadeTime) > TOKEN_EXPIRATION_TIME; // 50 minutes in milliseconds
}


/**
 * Fetches the authentication token using the chrome.identity API.
 * @returns {Promise<string>} A promise that resolves with the authentication token.
 */
function fetchAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      // save the current time + 1 hour into state.tokenExpirationTime
      const tokenMadeTime = Date.now();
      
      state.tokenMadeTime = tokenMadeTime;
      saveState(() => {
        resolve(token);
      })
    });
  });
}


function getToken() {
  return new Promise((resolve, reject) => {
    // console.log("=================");
    // console.log("state", state);
    // console.log("isTokenExpired", isTokenExpired(state.tokenMadeTime));
    // console.log("state.token", state.token);
    // console.log("=================");
    if (!!state.token && !isTokenExpired(state.tokenMadeTime)) {
      // Token is still valid, resolve with the existing token
      console.log("using existing token...");
      state.token = state.token;
      saveState(() => {
        resolve(state.token);
      })
    } else {
      // If there's no token or it's expired, fetch a new one
      console.log("fetching a fresh auth token...");
      fetchAuthToken().then( token => {
        state.token = token;
        saveState(() => {
          resolve(token);
        })
      }).catch(reject);
    }
  });
}


/**
 * Fetches the list of emails from the Gmail API.
 * @param {string} token - The access token for authentication.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of email messages.
 * @throws {Error} - If no messages are found.
 */
function fetchEmailList(token) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=200', {
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


// https://gmail.googleapis.com/gmail/v1/users/{userId}/labels
function fetchLabelList(token) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      if(!data.labels || data.labels.length === 0) {
        throw new Error('No labels found');
      }
      return data;
    })
    .then(data => {
      // console.log("data:", data);
      return data.labels;
    });

}

/**
 * Fetches email details from the Gmail API.
 * @param {string} token - The access token for authentication.
 * @param {string} messageId - The ID of the email message.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the email details.
 */
function fetchEmailDetails(token, messageId) {
  return fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      // Assuming data.raw contains the raw email
      var raw = atob(data.raw.replace(/-/g, '+').replace(/_/g, '/'));
      var decoded = new TextDecoder("utf-8").decode(new Uint8Array([...raw].map(char => char.charCodeAt(0))));

      // Extract and decode subject, from, and prepare body snippet
      var subjectMatch = decoded.match(/^Subject: (.*?)(?=\r\n)/m);
      var fromMatch = decoded.match(/^From:\s*((.|\n)*?)(?=\r\n)/m);

      var emailDetails = {
        subject: subjectMatch ? decodeMime(subjectMatch[1]).trim() : 'No subject',
        from: fromMatch ? decodeMime(fromMatch[1]).trim() : 'No from',
        body: data.snippet ? data.snippet.replace(/&#39;/g, "'")
                                         .replace(/&quot;/g, '"')
                                         .replace(/&amp;/g, '&') 
                                         : 'Message body parsing unsuccessful',
        labels: data.labelIds
      };

      return emailDetails; // Pass the prepared details back for display
    });
}


/**
 * Creates a new label in Gmail using the provided token and label name.
 * @param {string} token - The access token for authentication.
 * @param {string} labelName - The name of the label to create.
 * @returns {Promise<string>} - A promise that resolves with the ID of the created label.
 * @throws {Error} - If the label creation fails.
 */
function createLabel(token, labelName) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    })
  })
  .then(response => {
    if (!response.ok) {
      console.error(`Failed to create label: ${labelName}, status: ${response.status}, message: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.id) {
      return data.id;
    } else {
      // console.log(data);
      throw new Error(`Failed to create label: ${labelName}`);
    }
  });
}


/**
 * Retrieves the label ID for a given label name.
 * If the label is not found, it creates the label and returns its ID.
 *
 * @param {string} token - The access token for authentication.
 * @param {string} labelName - The name of the label to retrieve or create.
 * @returns {Promise<string>} - A promise that resolves to the label ID.
 */
function getLabelId(token, labelName) {
  return fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(response => response.json())
    .then(data => {
      const label = data.labels.find(label => label.name === labelName);
      if (label) {
        return label.id;
      } else {
        // Create the label if it's not found
        return createLabel(token, labelName);
      }
    });
}


function getLabelIdFromState(labelName, incomingState = state) {
  const label = incomingState.allLabels.find(label => label.name === labelName);
  if (label) {
    return label.id;
  } else {
    throw new Error(`Label '${labelName}' not found`);
  }
}


function hasNextEmail(index = state.currentIndex) {
  // Check if we're at the end of the list
  if (index >= state.messagesMetaInfo.length - 1) {
    return Promise.resolve(false);
  }

  // If we're not skipping, there is a next email
  if (!state.skipping) {
    return Promise.resolve(true);
  }

  // If we're skipping, check if the next email is reviewed
  const reviewedLabelId = getLabelIdFromState("reviewedTS");
  return fetchEmailDetails(state.token, state.messagesMetaInfo[index + 1].id)
    .then(emailDetails => {
      if (emailDetails.labels.includes(reviewedLabelId)) {
        // If the next email is reviewed, check the one after it
        return hasNextEmail(index + 1);
      } else {
        // If the next email is not reviewed, there is a next email
        return true;
      }
    })
    .catch(error => {
      console.error(error);
      return false;
    });
}


//// TODO: update handleRefreshEmail logic to update maxReviews as necessary if there
// are less than maxReviews threads in inbox, OR, if the index of the current email
// would leave less than the maxReviews threads to review
/**
 * Handles the refresh of email data, which may in turn update maxReviews
 * 
 * @param {Function} sendResponse - The function to send the response.
 * @returns {Promise} A promise that resolves with the email details.
 */
function handleRefreshEmail(sendResponse) {
  // console.log("refreshing email...");
  fetchEmailList(state.token).then(messages => {
    // console.log("============");
    // console.log("fetched threads:", messages);
    // console.log("threads count:", messages.length);
    // console.log("maxReviews:", state.maxReviews);
    // console.log("============");
    state.messagesMetaInfo = messages;
    // https://developers.google.com/gmail/api/reference/rest/v1/users.labels/list
    fetchLabelList(state.token).then(labels => {
      // populate state.allLabels with all the user's labels data (including names and ids)
      state.allLabels = labels.map(label => ({name: label.name, id: label.id}));
      // console.log("processed labels:", state.allLabels);
      
      // check to see if any of the TreeSwipe labels are missing
      // if any labels are missing, they need to be created
      const treeswipeLabels = getAllLabels();
      state.allLabels = state.allLabels.filter(label => treeswipeLabels.includes(label.name));
      if(treeswipeLabels.length !== state.allLabels.length) {
        console.log("missing labels detected...");
        const missingLabels = treeswipeLabels.filter(label => !state.allLabels.some(l => l.name === label));
        console.log("missing labels:", missingLabels);
        const delay = 150; // delay in milliseconds
        const promises = missingLabels.map((label, index) => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              createLabel(state.token, label).then(id => {
                // console.log(`created label '${label}' with id '${id}'`);
                state.allLabels.push({name: label, id});
                resolve();
              }).catch(error => reject(error));
            }, index * delay);
          });
        });
        Promise.all(promises).then(() => {
          console.log("all missing labels created successfully");
          saveState();
          // console.log("updated state labels", state.allLabels);
        }).catch(error => console.error("error creating missing labels:", error));
      }

      // If skipping is enabled, find the first email without the "reviewedTS" label
      if (state.skipping) {
        // console.log("skipping is enabled");
        const reviewedLabelId = getLabelIdFromState("reviewedTS");
        // Function to recursively check each email for the "reviewedTS" label
        const checkAndSkipReviewed = (index = 0) => {
          if (index >= state.messagesMetaInfo.length || state.maxReviews === 0) {
            //// TODO: this logic may not be robust enough, reevaluate for improvements
            // If we've checked all emails and didn't find any unreviewed, handle appropriately
            console.log("no unreviewed emails found.");
            sendResponse({ error: "No unreviewed emails found." });
            return;
          }

          fetchEmailDetails(state.token, state.messagesMetaInfo[index].id)
            .then(emailDetails => {
              if (!emailDetails.labels.includes(reviewedLabelId)) {
                // Found an unreviewed email, update state and send response
                state.currentIndex = index;
                state.reviewCount = 0;
                //// TODO: update logic to handle maxReviews more accurately
                // The current challenge is that the number of total unreviewed emails is unknown
                // to the application in its current state. What would need to change is to
                // find out how many unreviewed emails there are, and then set maxReviews to
                // the minimum of the total unreviewed emails and the user's desired maxReviews 
                // Call hasNextEmail and update maxReviews if necessary
                //// TODO: confirm that hasNextEmail should be called here rather than up above fetchEmailDetails
                hasNextEmail().then(hasNext => {
                  if (!hasNext) {
                    state.maxReviews = state.reviewCount + 1;
                    // console.log("maxReviews(?) updated to:", state.maxReviews);
                  }
                }).then(()=>{
                  state.currentEmailDetails = emailDetails;
                  sendResponse({
                    data: { state, reviewState },
                    type: "refreshEmail"
                  });
                  saveState(); //// TODO: confirm that saveState can be called here just after sendResponse w/o chaining/awaiting
                }).catch(error => sendResponse({ error: error.message }));
              } else {
                // Email has "reviewedTS" label, check the next one
                checkAndSkipReviewed(index + 1);
              }
            })
            .catch(error => sendResponse({ error: error.message }));
        };

        // Call hasNextEmail and update maxReviews if necessary
        hasNextEmail().then(hasNext => {
          if (!hasNext) {
            state.maxReviews = state.reviewCount + 1;
            // console.log("maxReviews updated to:", state.maxReviews);
          } else {
            //// TODO: notate somehow that this is an estimate/approximate, and may not be correct
            state.maxReviews = Math.min(state.maxReviews, state.messagesMetaInfo.length);
            // Start checking from the first email
            // console.log("more unreviewed emails exist, calling checkAndSkipReviewed");
          }
          checkAndSkipReviewed();
        })

      } else {
        // Skipping is not enabled, proceed with the first email as usual
        // console.log("skipping is off");
        state.currentIndex = 0;
        state.reviewCount = 0;
        ////
        state.maxReviews = Math.min(state.maxReviews, state.messagesMetaInfo.length);
        // console.log("maxReviews updated to:", state.maxReviews);
        // console.log("skipping is false, updating current email details A")
        fetchEmailDetails(state.token, state.messagesMetaInfo[0].id)
          .then(emailDetails => {
            state.currentEmailDetails = emailDetails;
            sendResponse({
              data: { state, reviewState },
              type: "refreshEmail"
            });
            saveState();
          })
          .catch(error => sendResponse({ error: error.message }));
      }

    }).catch(error => sendResponse({ error: error.message }));
  })
  .catch(error => sendResponse({ error: error.message }));
}


/**
 * Handles the logic for moving to the next email.
 *
 * @param {Function} sendResponse - The function to send the response back to the caller.
 */
function handleNextEmail(sendResponse) {
  if (state.skipping) {
    
    const reviewedLabelId = getLabelIdFromState("reviewedTS");

    // Function to check the next email and call itself if it is reviewed
    const checkAndSkipReviewed = (attempt = 0) => {
      if (state.currentIndex >= state.messagesMetaInfo.length) {
        // If we've reached the end of the list, handle appropriately, e.g., signal no more emails to review
        sendResponse({ error: "No more emails to review." });
        return;
      }

      if (attempt >= state.messagesMetaInfo.length) {
        // If we've checked all emails, handle appropriately, e.g., signal no more unreviewed emails
        sendResponse({ error: "No more unreviewed emails." });
        return;
      }

      hasNextEmail(state.currentIndex).then(hasNext => {
        if(!hasNext) {
          sendResponse({ error: "No more unreviewed emails." });
          return;
        } else {
          //// TODO: confirm that this logic here works as desired
          state.currentIndex = state.currentIndex + 1;
          fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id)
            .then(emailDetails => {
              if (!emailDetails.labels.includes(reviewedLabelId)) {
                // Found an unreviewed email, proceed as usual
                hasNextEmail().then(hasNext => {
                  if (!hasNext) {
                    state.maxReviews = state.reviewCount + 2;
                    // console.log("maxReviews(?) updated to:", state.maxReviews);
                  }
                }).then(() => {
                  state.currentEmailDetails = emailDetails;
                  state.reviewCount = state.reviewCount + 1;
                  //// TODO: confirm that send response followed by saveState order and call type/chain (async/async) is correct
                  sendResponse({
                    data: { state, reviewState },
                    type: "nextEmail"
                  });
                  saveState();
                }).catch(error => sendResponse({ error: error.message }));
                
              } else {
                // Current email is reviewed, check the next one
                checkAndSkipReviewed(attempt + 1);
              }
            })
            .catch(error => sendResponse({ error: error.message }));
        }
      }).catch(error => sendResponse({ error: error.message }));
    };

    // Start checking from the current index
    checkAndSkipReviewed();

  } else {
    // Original logic to move to the next email
    state.currentIndex = (state.currentIndex + 1);
    fetchEmailDetails(state.token, state.messagesMetaInfo[state.currentIndex].id)
      .then(emailDetails => {
        state.currentEmailDetails = emailDetails;
        state.reviewCount = state.reviewCount + 1;
        sendResponse({
          data: { state, reviewState },
          type: "nextEmail"
        });
      }).then(() => saveState())
      .catch(error => sendResponse({ error: error.message }));
  }
}


/**
 * Flips an object by swapping keys and values.
 *
 * @param {Object} obj - The object to be flipped.
 * @returns {Object} - The flipped object.
 */
function flipObject(obj) {
  const flipped = {};

  for (const [id, labels] of Object.entries(obj)) {
    for (const label of labels) {
      if (!flipped[label]) {
        flipped[label] = [];
      }
      flipped[label].push(id);
    }
  }

  return flipped;
}


/**
 * Handles applying all pending labels to the corresponding emails.
 * 
 * @param {Function} sendResponse - The callback function to send the response.
 */
function handleApplyAllLabels(sendResponse) {
  const localState = {...state}; // Create a local copy of state

  // Flip the object to get labels as keys and ids as values
  const labelsToIds = flipObject(localState.idsAndTheirPendinglabels);

  const delay = 200; // Delay in milliseconds

  Object.entries(labelsToIds).forEach(([label, ids], index) => {
    setTimeout(function() {
      batchAddLabels([getLabelIdFromState(label, localState)], ids);
    }, index * delay);
  });
}


/**
 * Handles starting a review session.
 *
 * @param {Function} sendResponse - The response callback function.
 * @param {number} maxReviews - The maximum number of reviews.
 * @param {boolean} skipping - Indicates whether skipping is enabled.
 */
function handleStartReviewSession(sendResponse, maxReviews, skipping, tokenMadeTime) {
  state.skipping = skipping;
  state.maxReviews = maxReviews;
  state.tokenMadeTime = tokenMadeTime;
  handleRefreshEmail(sendResponse);
}

/**
 * Adds labels (by name) to the pending labels list for the current email.
 *
 * @param {Array<string>} labels - The labels to be added.
 */
function addLabelsToPendingForCurrentEmail(labelNames) {
  const currentEmailId = state.messagesMetaInfo[state.currentIndex].id;
  // state.idsAndTheirPendinglabels[currentEmailId] gets the array of 
  // labels for the current email
  const currentLabels = state.idsAndTheirPendinglabels[currentEmailId] || [];
  
  state.idsAndTheirPendinglabels[currentEmailId] = [...currentLabels, ...labelNames];
  
  saveState();
}

/**
 * Removes labels from multiple Gmail messages in batch.
 *
 * @param {string[]} labelIds - An array of IDs of the labels to be removed.
 * @param {string[]} messageIds - An array of message IDs to remove the labels from.
 * @returns {Promise<void>} A promise that resolves when the label removal is successful, or rejects with an error.
 */
function batchRemoveLabels(labelIds, messageIds) {
  // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/batchModify
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify';
  const requestBody = {
      ids: messageIds,
      removeLabelIds: labelIds
  };

  return new Promise((resolve, reject) => {
      fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${state.token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
      })
      .then(response => {
          if (!response.ok) {
              reject(`HTTP error! status: ${response.status}`);
          }
          // note: when successful, the response body is empty
          if(response.status === 204) {
            // console.log("successful return from batchRemoveLabels");  
            resolve();
          }
      })
      .catch(error => {
          reject(error);
      });
  });
}


/**
 * Adds labels from multiple Gmail messages in batch.
 *
 * @param {string[]} labelIds - An array of IDs of the labels to be added.
 * @param {string[]} messageIds - An array of message IDs to add the labels to.
 * @returns {Promise<void>} A promise that resolves when the label adding is successful, or rejects with an error.
 */
function batchAddLabels(labelIds, messageIds) {
  // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/batchModify
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify';
  const requestBody = {
      ids: messageIds,
      addLabelIds: labelIds
  };

  return new Promise((resolve, reject) => {
      fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${state.token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
      })
      .then(response => {
          if (!response.ok) {
              reject(`HTTP error! status: ${response.status}`);
          }
          // note: when successful, the response body is empty
          if(response.status === 204) {
            // console.log("successful return from batchAddLabels");  
            resolve();
          }
      })
      .catch(error => {
          reject(error);
      });
  });
}


/**
 * Handles the message request and performs different actions based on the provided action.
 *
 * @param {string} action - The action to be performed.
 * @param {Function} sendResponse - The function to send the response.
 * @param {number} maxReviews - The maximum number of reviews.
 * @param {boolean} skipping - Indicates whether skipping is enabled or not.
 */
function handleMessageRequest(action, sendResponse, maxReviews, skipping, tokenMadeTime) {
  getToken().then(t => {
    state.token = t; //// TODO: confirm correct token assignment
    if (action === "nextQuestionNo") {
      const { currentQuestion } = reviewState;
      reviewState.currentQuestion = ts.getNextQ(currentQuestion, "no");
      reviewState.questionText = ts.getNodeText(reviewState.currentQuestion);
      reviewState.questionExplanation = ts.getQexplanation(reviewState.currentQuestion) || '';
      const isLeaf = ts.isLeafNode(reviewState.currentQuestion);
      if(!isLeaf) {
        reviewState.yesBtnTitle = ts.getNodeText(ts.getNextQ(reviewState.currentQuestion, "yes"));
        reviewState.noBtnTitle = ts.getNodeText(ts.getNextQ(reviewState.currentQuestion, "no"));
      }
      // if the current question is a leaf node, we will signal to display two different
      // buttons, an 'Apply Label' button and a 'Redo' button which goes back to node 'a'
      // for the current email thread. we can do this with a boolean flag in the response
      reviewState.isLeafNode = isLeaf;
      sendResponse({ data: { state, reviewState }, type: action });
    } else if (action === "nextQuestionYes") {
      const { currentQuestion } = reviewState;
      reviewState.currentQuestion = ts.getNextQ(currentQuestion, "yes");
      reviewState.questionText = ts.getNodeText(reviewState.currentQuestion);
      reviewState.questionExplanation = ts.getQexplanation(reviewState.currentQuestion);
      const isLeaf = ts.isLeafNode(reviewState.currentQuestion);
      if(!isLeaf) {
        reviewState.yesBtnTitle = ts.getNodeText(ts.getNextQ(reviewState.currentQuestion, "yes"));
        reviewState.noBtnTitle = ts.getNodeText(ts.getNextQ(reviewState.currentQuestion, "no"));
      }
      reviewState.isLeafNode = isLeaf;
      sendResponse({ data: { state, reviewState }, type: action });
    } else if (action === "loadFromState") {
      resetReviewState();
      saveState(() => {
        sendResponse({ data: { state, reviewState }, type: action });
      });
    } else if (action === "nextEmail") {
      resetReviewState();
      addLabelsToPendingForCurrentEmail(["reviewedTS"]);
      handleNextEmail(sendResponse);
    } else if (action === "skipEmail") {
      resetReviewState();
      // console.log("skipping email");
      handleNextEmail(sendResponse);
    } else if (action === "getState") {
      sendResponse({ state });
    } else if (action === "applyLabelAndGotoNextEmail") {
      let currentLabels = ts.getNodeLabels(reviewState.currentQuestion);
      // let currentLabelsString = currentLabels.join(", ");
      addLabelsToPendingForCurrentEmail(["reviewedTS", ...currentLabels]);
      // sendResponse({ type: "notification", message: `Labels '${currentLabelsString}' applied successfully` });
      resetReviewState();
      handleNextEmail(sendResponse);
    } else if (action === "applyLabelsAndFinish") {
      let currentLabels = ts.getNodeLabels(reviewState.currentQuestion);
      addLabelsToPendingForCurrentEmail(["reviewedTS", ...currentLabels]);
      handleApplyAllLabels(sendResponse);
      state = { ...initialState, token: state.token, messagesMetaInfo: state.messagesMetaInfo, skipping: state.skipping, tokenMadeTime: state.tokenMadeTime};
      saveState(()=> {
        // console.log("finishing review session via 'applyLabelsAndFinish' action");
        //// TODO: enable the following line to send a notification to the user
        sendResponse({ type: action, message: `${state.maxReviews} threads reviewed successfully.`});
      });
    } else if (action === "startReviewSession") {
      // anonymous function that passes in the response object and 
      // updates it with the startReviewSession action type
      handleStartReviewSession((response) => sendResponse({ ...response, type: action }), maxReviews, skipping, tokenMadeTime);
    }
    // https://developers.google.com/gmail/api/reference/rest/v1/users.labels/list
    else if (action === "clearAllLabels") {
      // console.log("clearing all labels...");
      fetchEmailList(state.token).then(messages => {
        state.messagesMetaInfo = messages;
    
        fetchLabelList(state.token).then(labels => {
          // populate state.allLabels with all the user's labels data (including names and ids)
          state.allLabels = labels.map(label => ({name: label.name, id: label.id}));

          //// filter state.allLabels to only include TreeSwipe labels
          const treeswipeLabels = getAllLabels();
          state.allLabels = state.allLabels.filter(label => treeswipeLabels.includes(label.name));

          // Get all labelIds
          const labelIds = state.allLabels.map(label => getLabelIdFromState(label.name));
      
          // Get all messageIds
          let messageIds = state.messagesMetaInfo.map(message => message.id);
      
          // Check if there are no messageIds
          if (labelIds.length === 0) {
            throw new Error("No label IDs found");
          }

          // Check if there are no messageIds
          if (messageIds.length === 0) {
            throw new Error("No message IDs found");
          }
      
          // Call batchRemoveLabels once with all labelIds and messageIds
          batchRemoveLabels(labelIds, messageIds)
            .then(() => sendResponse({ type: "notification", message: "All labels cleared successfully." }))
            .catch(error => sendResponse({ error: error.message }));
        });
      });
    }
    // quit early w/o applying any labels
    else if (action === "returnToSetup") {
      const { skipping } = state; // keep skipping state
      state = { ...initialState, skipping, token: state.token, tokenMadeTime: state.tokenMadeTime};
      saveState(()=>{
        // console.log("return to setup, state cleared:", state);
        sendResponse({ type: action });
      });
    } 
    // finish review session, apply labels, and quit
    else if (action === "finishReview") {
      addLabelsToPendingForCurrentEmail(["reviewedTS"]);
      handleApplyAllLabels(sendResponse);
      state = { ...initialState, 
                token: state.token, 
                tokenMadeTime: state.tokenMadeTime, 
                messagesMetaInfo: state.messagesMetaInfo, 
                skipping: state.skipping};
      saveState(() => {
        // console.log("finishing review session");
        sendResponse({ type: action });
      });
    } else if (action === "updateSkipping") {
      state.skipping = skipping;
      saveState(() => {
        sendResponse({ data: { state, reviewState }, type: action });
      });
    } else if (action === "resetState") {
      resetState(() => {
        sendResponse({ type: "notification", 
                        message: "State reset successfully" });
      });
    }
  });
}


/*
  * Listens for messages from the popup and content script.
  */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, maxReviews, skipping, tokenMadeTime } = request;
  if (action === "refreshEmail" || action === "nextEmail" || action === "getState" ||
    action === "loadFromState" || action === "startReviewSession" ||
    action === "returnToSetup" || action === "finishReview" || action === "clearAllLabels" || action === "resetState" || 
    action === "nextQuestionNo" || action === "nextQuestionYes" || 
    action === "applyCurrentNodeLabel" || action === "updateSkipping" || 
    action === "skipEmail" || action === "applyLabelAndGotoNextEmail" || 
    action === "applyLabelsAndFinish") {
    handleMessageRequest(action, sendResponse, maxReviews, skipping, tokenMadeTime);
  } else {
    sendResponse({ error: "Invalid action" });
  }
  return true; // indicates async response
});