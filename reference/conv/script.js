// ========================================================================
// ===                       CONFIGURATION CONSTANTS                    ===
// ========================================================================

/**
 * Set to true to use real backend API calls for LLM interaction.
 * Set to false to use the built-in mock functions for testing without a backend.
 */
const PROD = true;
apiKey = '';// for extraction from mistral
flashApiKey = '';
// --- API Endpoints (Only used if PROD = true) ---
const LLM_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + flashApiKey;       // REPLACE with your actual backend endpoint for chat
const LLM_EXTRACTION_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions'; // REPLACE with your actual backend endpoint for extraction

// --- Behavior ---
const PAUSE_DURATION_MS = 5000; // How long the user must pause (in ms) to trigger assistant reply
const MOCK_LLM_DELAY_MIN_MS = 500;   // Min simulated network delay for mock LLM
const MOCK_LLM_DELAY_MAX_MS = 1200;  // Max simulated network delay for mock LLM
const MOCK_EXTRACTION_DELAY_MS = 800; // Simulated delay for mock extraction

// --- Speech Recognition ---
const SPEECH_RECOGNITION_LANG = 'en-US'; // Language code (e.g., 'en-US', 'es-ES')
const RESTART_LISTENER_DELAY_MS = 250; // Delay before restarting listener after it stops unexpectedly
const RESTART_AFTER_ERROR_DELAY_MS = 500; // Delay before restarting after 'no-speech' error

// --- Speech Synthesis ---
const SPEECH_SYNTHESIS_LANG = 'en-US'; // Language code for assistant voice
const SPEECH_VOICE_INDEX =5;
const SPEECH_SYNTHESIS_RATE = 1.0;   // Speaking rate (0.1 to 10)
const GREETING_MESSAGE = "Hello! How can I help you today?";

// --- LLM Interaction ---
// Optional: A system prompt to guide the LLM's behavior (if your backend/LLM supports it)
// const DEFAULT_SYSTEM_PROMPT = 'You are a helpful voice assistant focusing on taking customer orders and information.Answer in less than three sentence.';
const DEFAULT_SYSTEM_PROMPT = 'Act like a therapist and help user with finding the root of there problems. Ask deeper and personal qeuestions. respond in less than three sentence.';

// --- Error Messages ---
const ERROR_MSG_SPEECH_API_UNSUPPORTED = 'Error: Speech Recognition or Synthesis not supported in this browser.';
const ERROR_MSG_MIC_PERMISSION_DENIED = 'Error: Microphone permission denied.';
const ERROR_MSG_MIC_NOT_FOUND = 'Error: No microphone found or permission denied.';
const ERROR_MSG_LLM_CONNECTION = "Sorry, I couldn't connect to my brain right now.";
const ERROR_MSG_EXTRACTION_FAILED = "Error extracting information.";
const ERROR_MSG_EXTRACTION_API_FAILED = "Could not extract information due to an API error.";
const ERROR_MSG_LLM_RESPONSE_INVALID = "LLM response missing 'reply' field.";
const ERROR_MSG_DEFAULT_SPEECH_RECOGNITION = 'Speech recognition error:'; // Prefix
const ERROR_MSG_TTS_FAILED = "Sorry, I encountered an error and couldn't speak.";


// ========================================================================
// ===                         APPLICATION CODE                         ===
// ========================================================================

// --- DOM Elements ---
const statusDiv = document.getElementById('status');
const toggleButton = document.getElementById('toggleButton');
const transcriptDiv = document.getElementById('transcript');
const extractedDataDiv = document.getElementById('extractedData');

// --- State Variables ---
let isListening = false;
let recognition;
let speechSynth;
let conversationHistory = []; // Stores { role: 'user' | 'assistant', content: 'text' }
let pauseTimeout;
let finalUserTranscript = ''; // Accumulates final transcript fragments within a single user turn
let recognizing = false; // Track if recognition engine is actively running

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

// --- Speech Recognition Setup ---
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

// --- Core Logic Functions ---
function toggleConversation() {
    if (isListening) {
        stopConversation();
    } else {
        startConversation();
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

    // Add system prompt if defined
    if (DEFAULT_SYSTEM_PROMPT) {
        conversationHistory.push({ role: 'model', content: DEFAULT_SYSTEM_PROMPT });
    }

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
    appendMessage('user', userText);
    conversationHistory.push({ role: 'user', content: userText });
    finalUserTranscript = ''; // Reset accumulated transcript for the *next* user turn

    try {
        // === LLM Call (handles PROD flag internally) ===
        const assistantResponseText = await callLLM(conversationHistory);

        // Add assistant response to transcript and history
        appendMessage('assistant', assistantResponseText);
        conversationHistory.push({ role: 'assistant', content: assistantResponseText });

        // === Speak Assistant Response ===
        statusDiv.textContent = 'Status: Speaking...';
        await speak(assistantResponseText);

        // === Restart Listening (if still active) ===
        // The recognition.onend handler should now automatically attempt to restart
        // because 'isListening' is still true. We ensure status reflects waiting state.
         if (isListening) {
            console.log("Speaking finished. Expecting recognition.onend to restart listener.");
            statusDiv.textContent = 'Status: Waiting for listener restart...';
            // If the onend handler proves unreliable, an explicit start could be added here,
            // but prefer letting the event handler manage it for cleaner state control.
            // if (!recognizing) { try { recognition.start(); } catch(e) {...}}
        }

    } catch (error) {
        console.error("Error during LLM call or speaking:", error);
        statusDiv.textContent = 'Error: Could not get response.';
        speak(ERROR_MSG_TTS_FAILED).finally(() => {
            // Try to restart listening even after an error, if appropriate
            if (isListening && !recognizing) {
                console.log("Attempting listener restart after error message.");
                // Rely on onend triggered by potential recognition.stop() earlier,
                // or if no stop happened, maybe attempt manual start.
                // For now, rely on onend triggered by errors or manual stops.
            }
        });
    }
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

    toggleButton.textContent = 'Start Conversation';


    // --- Final Information Extraction ---
    // Run this *after* ensuring recognition is fully stopped. A small delay can help.
    setTimeout(() => {
         if (!isListening) { // Ensure state hasn't changed back
            extractInformation(conversationHistory);
         }
     }, 100); // Short delay for state consistency
}





async function extractInformation(history) {
    if (history.filter(m => m.role !== 'system').length === 0) { // Ignore system prompt for empty check
        extractedDataDiv.textContent = "No conversation history to analyze.";
        statusDiv.textContent = 'Status: Idle (No history)';
        return;
    }

    console.log("Requesting information extraction...");
    statusDiv.textContent = 'Status: Extracting info...';


    try {
        // === LLM Extraction Call (handles PROD flag internally) ===
        const extractedInfo = await callLLMForExtraction(history);

        if (extractedInfo && extractedInfo.error) {
             extractedDataDiv.textContent = `Extraction Failed: ${extractedInfo.error}`;
        } else {
             extractedDataDiv.textContent = JSON.stringify(extractedInfo, null, 2); // Pretty print JSON
        }
        console.log("Extraction complete:", extractedInfo);

    } catch (error) { // Catch errors from the call itself (e.g., network for PROD)
        console.error("Error during information extraction call:", error);
        extractedDataDiv.textContent = ERROR_MSG_EXTRACTION_FAILED;
    } finally {
         // Ensure status updates to Idle even if extraction failed
         if (!isListening) { // Check we are still in the stopped state
             statusDiv.textContent = 'Status: Idle (Extraction Attempted)';
         }
    }
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

// --- Transcript Display ---
function appendMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add(role === 'user' ? 'user-msg' : 'assistant-msg');
    messageDiv.textContent = `[${role === 'user' ? 'You' : 'Assistant'}]: ${text}`;
    transcriptDiv.appendChild(messageDiv);
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight; // Scroll to bottom
}


// ========================================================================
// ===                 LLM Interaction Functions (PROD/Mock)            ===
// ========================================================================

/**
 * Sends conversation history to LLM (real or mock) and returns the response.
 */
async function callLLM(chatHistory) {
  console.log(`Calling LLM. PROD = ${PROD}`);
  statusDiv.textContent = 'Status: Thinking...'; // Update status during call

  if (PROD) {
      // --- REAL IMPLEMENTATION (Gemini API via Backend) ---
      console.log("Making REAL API call to Gemini via:", LLM_API_ENDPOINT);

      try {
          // Construct the request body for Gemini's chat completion API.
          // Adapt this to match Gemini's specific input format:
          const requestBody = {
              contents: chatHistory.map(message => ({
                  role: message.role, // e.g., "user" or "model"
                  parts: [{ text: message.content }]
              })),
              // Add any other Gemini-specific parameters you need:
              // safetySettings: [...],
              // generationConfig: {...}
          };

          const response = await fetch(LLM_API_ENDPOINT, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  // IMPORTANT: Your backend should add any necessary Authorization headers.
                  // NEVER include your API key directly in frontend JavaScript.
                  // The backend protects your key.
              },
              body: JSON.stringify(requestBody), // Send Gemini-formatted request
          });

          if (!response.ok) {
              // Handle HTTP errors, attempting to extract error details from the response.
              let errorBody = await response.text();
              console.error("Gemini API Error Response:", errorBody); // Log for debugging
              throw new Error(`Gemini API Error: ${response.status} ${response.statusText}. ${errorBody}`);
          }

          const data = await response.json(); // Parse the JSON response from the backend
          console.log("Gemini API Raw Response:", data);  // Inspect the entire raw response


          // Extract the text from the Gemini response.  This is where Gemini responses differ.
          // You *must* adjust this logic based on the *actual* structure of Gemini's JSON response.
          // Example (adapt as needed):
          if (data && data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
              const geminiReply = data.candidates[0].content.parts[0].text;

              if (typeof geminiReply !== 'string') {
                  console.error("Gemini response part is not a string:", geminiReply);
                  throw new Error("Gemini API returned a non-string reply.");
              }

              console.log("Gemini API Reply:", geminiReply); // The extracted text
              return geminiReply;
          } else {
              console.error("Unexpected Gemini response structure:", data);
              throw new Error("Unexpected Gemini API response structure.  See console for details.");
          }

      } catch (error) {
          console.error("Gemini API Fetch Error:", error); // Log for debugging
          return ERROR_MSG_LLM_CONNECTION; // User-friendly message
      }

  } else {
      // --- MOCK IMPLEMENTATION (same as before) ---
      console.log("Simulating LLM call with history:", chatHistory);
      const delay = MOCK_LLM_DELAY_MIN_MS + Math.random() * (MOCK_LLM_DELAY_MAX_MS - MOCK_LLM_DELAY_MIN_MS);
      await new Promise(resolve => setTimeout(resolve, delay));

      // ... (rest of your mock implementation) ...
      console.log("Simulated LLM Response:", reply);
      return reply;
  }
}

/**
 * Sends conversation history for information extraction (real or mock).
 */
async function callLLMForExtraction(chatHistory) {
     console.log(`Calling LLM Extraction. PROD = ${PROD}`);
     statusDiv.textContent = 'Status: Extracting info...';

    if (PROD) {
        // --- REAL IMPLEMENTATION ---
         console.log("Making REAL Extraction API call to:", LLM_EXTRACTION_ENDPOINT);

         // You might construct a specific prompt for extraction if your backend expects it
         // Example: Combine history into a single string or send structured history + instructions

         const extractionPayload = {
          model: "mistral-small-latest",
          messages: [
             // Optionally add specific instructions for your backend/LLM
             {role: "system",  content : `
              Extract user name, address, and order details from the conversation history. Output as JSON with keys 'name', 'address', 'order_details'. If information is missing, use 'Not Found'.
              
              ${JSON.stringify(chatHistory)}
              
              `}]
         };

         try {
            const response = await fetch(LLM_EXTRACTION_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify(extractionPayload),
            });

            if (!response.ok) {
                let errorBody = await response.text();
                console.error("LLM Extraction API Error Response:", errorBody);
                throw new Error(`LLM Extraction API Error: ${response.status} ${response.statusText}. ${errorBody}`);
            }

            const data = await response.json(); // Assuming the API returns the JSON object directly
            console.log("Real LLM Extraction Response:", data);
            // Add basic validation if possible
            if (typeof data !== 'object' || data === null) {
                console.error("Invalid Extraction response format:", data);
                return { error: "Received invalid format from extraction API." };
            }
            return data.choices[0].message; // Extract the message from the response

        } catch (error) {
            console.error("LLM Extraction Fetch Error:", error);
            return { error: ERROR_MSG_EXTRACTION_API_FAILED }; // Return an error object
        }

    } else {
        // --- MOCK IMPLEMENTATION ---
        console.log("Simulating LLM Extraction Call with history length:", chatHistory.length);
        await new Promise(resolve => setTimeout(resolve, MOCK_EXTRACTION_DELAY_MS)); // Simulate delay

        const extracted = {
            name: "Not Found",
            address: "Not Found",
            order_details: "Not Found",
            analysis_mode: "Mock"
        };
        // Simple keyword-based mock extraction
        let textContent = chatHistory.map(m => m.content).join(' ').toLowerCase();

        const nameMatch = textContent.match(/my name is (\w+)/);
        if (nameMatch) extracted.name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1); // Capitalize

        const addressMatch = textContent.match(/(?:address is|live at) (.*?)(?:and|so|then|\.|$|,)/);
        if (addressMatch) extracted.address = addressMatch[1].trim().replace(/^(?:the|my)\s*/, ''); // Clean up a bit
        else if (textContent.includes("123 main st")) extracted.address = "123 Main St (Mock Found)";

        const orderMatch = textContent.match(/(?:order|like|want) (a|some|\d+)\s(.*?)(?:please|thanks|\.|$|,)/);
        if (orderMatch) extracted.order_details = `${orderMatch[1]} ${orderMatch[2]}`.trim();
        else if (textContent.includes("pizza") && !extracted.order_details) extracted.order_details = "Pizza (Mock Found)";
        else if (textContent.includes("burger") && !extracted.order_details) extracted.order_details = "Burger (Mock Found)";

        console.log("Simulated Extraction Result:", extracted);
        return extracted;
    }
}
