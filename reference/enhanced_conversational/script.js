// --- Behavior ---
const PAUSE_DURATION_MS = 5000; // How long the user must pause (in ms) to trigger assistant reply

// --- Speech Recognition ---
const SPEECH_RECOGNITION_LANG = 'en-US'; // Language code (e.g., 'en-US', 'es-ES')
const RESTART_LISTENER_DELAY_MS = 250; // Delay before restarting listener after it stops unexpectedly
const RESTART_AFTER_ERROR_DELAY_MS = 500; // Delay before restarting after 'no-speech' error

// --- Speech Synthesis ---
const SPEECH_SYNTHESIS_LANG = 'en-US'; // Language code for assistant voice
const SPEECH_VOICE_INDEX =5;
const SPEECH_SYNTHESIS_RATE = 1.0;   // Speaking rate (0.1 to 10)
const GREETING_MESSAGE = "Hello! How can I help you today?";


// --- DOM Elements ---
const statusDiv = document.getElementById('status') || document.createElement('div');
const toggleButton = document.getElementById('toggleButton') || document.createElement('button');
const transcriptDiv = document.getElementById('transcript') || document.createElement('div');
const extractedDataDiv = document.getElementById('extractedData') || document.createElement('div');

// --- State Variables ---
let isListening = false;
let recognition;
let speechSynth;
let conversationHistory = []; // Stores { role: 'user' | 'assistant', content: 'text' }
let pauseTimeout;
let finalUserTranscript = ''; // Accumulates final transcript fragments within a single user turn
let recognizing = false; // Track if recognition engine is actively running

// --- Main callbacks ---
onStartConversation = () => {
    console.log("Conversation started:");
}

onStopConversation = (conversationHistory) => { 
    console.log("Conversation stopped:", conversationHistory);
}

// --- Browser Feature Check ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
const speechSynthesis = window.speechSynthesis;

if (!SpeechRecognition || !SpeechSynthesisUtterance || !speechSynthesis) {
    statusDiv.textContent = ERROR_MSG_SPEECH_API_UNSUPPORTED;
    toggleButton.disabled = true;
} else {
    speechSynth = speechSynthesis;
    toggleButton.addEventListener('click', toggleConversation);
    setupSpeechRecognition(); // Setup initially but don't start
}

function setupSpeechRecognition() {
  recognition = new SpeechRecognition();
  recognition.continuous = true;        // We manage pauses manually
  recognition.interimResults = true;      // Get results as user speaks
  recognition.lang = SPEECH_RECOGNITION_LANG;

  recognition.onstart = () => {
      recognizing = true;
      statusDiv.textContent = 'Status: Listening...';
      console.log('Speech recognition started.');
  };

  recognition.onresult = (event) => {
      clearTimeout(pauseTimeout); // Reset pause timer on new speech data

      let interimTranscript = '';
      let currentFinalTranscript = ''; // Transcript finalized in *this specific event*

      for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
              currentFinalTranscript += transcriptPart.trim() + ' ';
          } else {
              interimTranscript += transcriptPart;
          }
      }

      // Append newly finalized text to the turn's accumulated final transcript
      if (currentFinalTranscript) {
          finalUserTranscript += currentFinalTranscript;
          console.log("Final fragment added:", currentFinalTranscript);
          console.log("Accumulated final transcript for turn:", finalUserTranscript);

          // Restart the pause timer *only after* a final result is received
          pauseTimeout = setTimeout(() => {
              if (isListening && finalUserTranscript.trim()) {
                  handleUserPause(finalUserTranscript.trim());
              }
          }, PAUSE_DURATION_MS);
      }

      // Optional: Display interim results (e.g., for visual feedback)
      // console.log("Interim: ", interimTranscript);
  };

  recognition.onerror = (event) => {
      recognizing = false;
      console.error(`${ERROR_MSG_DEFAULT_SPEECH_RECOGNITION}`, event.error, event.message);

      if (event.error === 'no-speech' && isListening) {
          // Briefly pause, then attempt restart if still supposed to be listening
          setTimeout(() => {
              if (isListening && !recognizing) { // Double-check state
                  console.log("Attempting restart after no-speech...");
                  try { recognition.start(); }
                  catch (e) {
                       console.error("Error restarting recognition after no-speech:", e);
                       stopConversation(); // Give up if restart fails
                  }
              }
          }, RESTART_AFTER_ERROR_DELAY_MS);
      } else if (event.error === 'audio-capture') {
          statusDiv.textContent = ERROR_MSG_MIC_NOT_FOUND;
          stopConversation();
      } else if (event.error === 'not-allowed') {
          statusDiv.textContent = ERROR_MSG_MIC_PERMISSION_DENIED;
          stopConversation();
      } else {
          // Handle other errors potentially by stopping
          statusDiv.textContent = `Error: ${event.error}`;
           stopConversation();
      }
  };

  recognition.onend = () => {
      recognizing = false;
      console.log('Speech recognition ended.');
      clearTimeout(pauseTimeout); // Clear timer when recognition stops explicitly

      // Only restart if we are meant to be listening AND it wasn't stopped manually or due to critical error
      if (isListening) {
          statusDiv.textContent = 'Status: Restarting listener...';
           // Add a small delay before restarting to prevent busy-looping on errors
           setTimeout(() => {
              if (isListening && !recognizing) { // Double check state before restarting
                  try {
                      console.log("Attempting restart via onend handler...");
                      recognition.start();
                  } catch (e) {
                       console.error("Error restarting recognition onend:", e);
                       statusDiv.textContent = 'Error: Could not restart listener.';
                       stopConversation(); // Stop if restart fails
                  }
              }
          }, RESTART_LISTENER_DELAY_MS);
      } else {
          statusDiv.textContent = 'Status: Idle'; // Stopped intentionally
      }
  };
}

function toggleConversation(event) {
  if (isListening) {
      return stopConversation(event);
  } else {
      if(event)
      onHandlePause = event;
      startConversation();
      return "";
  }
}

function startConversation() {
  if (!SpeechRecognition || recognizing) return; // Guard against unsupported/already starting

  isListening = true;
  toggleButton.textContent = 'Stop Conversation';
  statusDiv.textContent = 'Status: Initializing...';
  transcriptDiv.innerHTML = ''; // Clear transcript display
  extractedDataDiv.textContent = 'Conversation not ended or extraction not run.';
  conversationHistory = []; // Reset history
  finalUserTranscript = ''; // Reset accumulated transcript



  // Request microphone permission explicitly if needed (usually happens on first .start())
  // Can add navigator.mediaDevices.getUserMedia here for earlier prompt if desired.

  // Greet the user, then start listening
  speak(GREETING_MESSAGE).then(() => {
      if (isListening) { // Check if user hasn't clicked Stop during greeting
           try {
              recognition.start();
          } catch (e) {
               console.error("Error starting recognition:", e);
               statusDiv.textContent = 'Error: Could not start listening.';
               stopConversation();
          }
      }
  }).catch(err => {
       console.error("Speech synthesis error during greeting:", err);
       statusDiv.textContent = 'Error: Could not speak greeting.';
       // Still try to start listening if mic works
       if (isListening) {
           try { recognition.start(); } catch(e) { stopConversation(); }
       } else {
          stopConversation();
       }
  });
}


async function handleUserPause(userText) {
  if (!userText || !isListening) return; // Ignore empty pauses or if stopped

  console.log("User paused, processing text:", userText);
  statusDiv.textContent = 'Status: Thinking...';

  // Stop recognition temporarily while LLM thinks and speaks
  if(recognizing) {
     recognition.stop(); // This will trigger 'onend' which handles restart logic later
  }
  clearTimeout(pauseTimeout); // Ensure pause timer is cleared

  // Add user message to transcript and history
  console.log("----------------------Adding user message to conversation history:", userText);
  
  conversationHistory.push({ role: 'user', content: userText });
  finalUserTranscript = ''; // Reset accumulated transcript for the *next* user turn
  onHandlePause({'conversationHistory': conversationHistory});
}

// --- Text-to-Speech Function ---
function speak(text) {
  return new Promise((resolve, reject) => {
      if (!text) {
           console.warn("Skipping empty TTS.");
           resolve();
           return;
       }
       // Cancel any previously queued utterances to prevent overlap if calls are rapid
       speechSynth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_SYNTHESIS_LANG;
      utterance.rate = SPEECH_SYNTHESIS_RATE;
      utterance.voice = speechSynth.getVoices()[SPEECH_VOICE_INDEX];

      // Optional: Find a specific voice
      // const voices = speechSynth.getVoices();
      // utterance.voice = voices.find(v => v.name === 'Google US English') || voices[0];

      let spoken = false; // Flag to prevent double resolve/reject
      utterance.onstart = () => {
          console.log("Speech synthesis started for:", text.substring(0, 30) + "...");
          // Status is usually set by the calling function (handleUserPause)
      };

      utterance.onend = () => {
           if (spoken) return;
           spoken = true;
          console.log("Speech synthesis finished.");
          resolve(); // Resolve the promise when speaking naturally finishes
      };

      utterance.onerror = (event) => {
           if (spoken) return;
           spoken = true;
          console.error('Speech synthesis error:', event.error);
          reject(event.error); // Reject the promise on error
      };

       // Handle cases where cancel() might be called immediately after speak()
       utterance.onboundary = (event) => { // Or use onstart
           if (speechSynth.speaking && !spoken) {
               // console.log("TTS boundary event");
           } else if (!speechSynth.speaking && !spoken) {
               // If it stopped speaking unexpectedly (e.g., cancel) before onend/onerror
               console.warn("TTS seems to have been cancelled or stopped early.");
               // We might resolve or reject based on context, but resolving is safer default
               spoken = true;
               resolve();
           }
       };


      speechSynth.speak(utterance);
  });
}


function stopConversation() {
  if (!isListening) return;

  console.log("Stopping conversation.");
  isListening = false; // Signal to stop any restart loops
  clearTimeout(pauseTimeout);
  speechSynth.cancel(); // Stop any current speech

   if(recognizing) {
      recognition.stop(); // Stop listening engine
  } else {
      // If not currently recognizing (e.g., stopped between turns), update status directly
      statusDiv.textContent = 'Status: Processing final information...';
  }
   // Recognition.onend will fire after stop(), setting status to Idle if isListening is false

  

  // --- Final Information Extraction ---
  // Run this *after* ensuring recognition is fully stopped. A small delay can help.
  setTimeout(() => {
       if (!isListening) { // Ensure state hasn't changed back
        onStopConversation(conversationHistory);
       }
   }, 100); // Short delay for state consistency

   return conversationHistory;
}
