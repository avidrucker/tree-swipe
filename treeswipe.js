const NODES = {
    "a": "Is it clear?",
    "b": "Put into CLARIFY box.",
    "c": "Is it an ACTIONABLE item?",
    "d": "Is it TRASH?",
    "e": "Is it DOABLE NOW?",
    "f": "Is it REFERENCE material?",
    "g": "Put into TRASH bin.",
    "h": "Is it BLOCKED by anything?",
    "i": "Is it DOABLE IN 2 MIN?",
    "j": "Put into MISC box.",
    "k": "Put into REFERENCE box.",
    "l": "Can it be SCHEDULED?",
    "m": "Put into BLOCKED box & label to add blockers to INBOX.",
    "n": "Is it DOABLE IN ONE SITTING?",
    "o": "Put into DO-IT box & label TINY.",
    "p": "Put into TICKLER folder.",
    "q": "Schedule on the CALENDAR.",
    "r": "Is it a PROJECT?",
    "s": "Put into DO-IT box.",
    "t": "SPLIT it & put split items into INBOX.",
    "u": "Put into PROJECTS folder."
};

const EDGES = {
    "a": { "no": "b", "yes": "c" },
    "c": { "no": "d", "yes": "e" },
    "d": { "no": "f", "yes": "g" },
    "e": { "no": "h", "yes": "i" },
    "f": { "no": "j", "yes": "k" },
    "h": { "no": "l", "yes": "m" },
    "i": { "no": "n", "yes": "o" },
    "l": { "no": "p", "yes": "q" },
    "n": { "no": "r", "yes": "s" },
    "r": { "no": "t", "yes": "u" }
};

const LABELS = {
    "b": ["reviewed", "clarify"],
    "g": ["reviewed", "trash-it"],
    "j": ["reviewed", "misc"],
    "k": ["reviewed", "reference"],
    "m": ["reviewed", "blocked", "add-blockers-to-inbox"],
    "o": ["reviewed", "do-it", "tiny"],
    "p": ["reviewed", "tickler"],
    "q": ["reviewed", "calendar"],
    "s": ["reviewed", "do-it"],
    "t": ["reviewed", "split", "add-split-items-to-inbox"],
    "u": ["reviewed", "projects"]
};

function getNextQ(qKey, answer) {
    return EDGES[qKey][answer];
}

function progressToNextQ(stateInput) {
    stateInput.nextQ = getNextQ(currentQuestion, currentAnswer);

    return stateInput;
}

function nodeIsLeaf(nodeKey) {
    return EDGES[nodeKey] === undefined || EDGES[nodeKey] === null;
}

// export all variables and functions
module.exports = {
    NODES,
    EDGES,
    LABELS,
    getNextQ,
    progressToNextQ,
    nodeIsLeaf
};